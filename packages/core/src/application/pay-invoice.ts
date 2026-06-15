// Use case: pay an Invoice. Reactor pattern: reacts to PaymentReceived (or invoked explicitly).
// Idempotent on (invoiceId, paymentId).

import { appendIntents, enrich, followFrom, PaymentReceived, startLineage } from "@daedalus/core";
import type { CoreDeps } from "./deps.ts";
import { payInvoice } from "../domain/invoice.ts";
import { projectInvoice } from "./projections.ts";

export type PayInvoiceCommand = {
  tenantId: string;
  invoiceId: string;
  paymentId: string;
};

export async function payInvoiceUseCase(
  deps: CoreDeps,
  cmd: PayInvoiceCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const invoice = projectInvoice(events, cmd.invoiceId);
  if (invoice === null) {
    throw new Error(`Invoice ${cmd.invoiceId} not found in tenant ${cmd.tenantId}`);
  }
  // Source event: a PaymentReceived with this paymentId against this invoice's proposal.
  const source = events.find(
    (e) => e.type === PaymentReceived && e.payload.paymentId === cmd.paymentId,
  );

  const { events: intents } = payInvoice(invoice, cmd.paymentId);
  if (intents.length === 0) return { changed: false };

  const lineage = source !== undefined ? followFrom(source) : startLineage(deps.newId);
  for (const intent of intents) {
    await deps.eventStore.append(
      enrich(intent, {
        tenantId: cmd.tenantId,
        actor: deps.actor,
        newId: deps.newId,
        now: deps.now,
        lineage,
      }),
    );
  }
  return { changed: true };
}