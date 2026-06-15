// Use case: send an Invoice. Idempotent.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { sendInvoice } from "../domain/invoice.ts";
import { projectInvoice } from "./projections.ts";

export type SendInvoiceCommand = {
  tenantId: string;
  invoiceId: string;
};

export async function sendInvoiceUseCase(
  deps: CoreDeps,
  cmd: SendInvoiceCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const invoice = projectInvoice(events, cmd.invoiceId);
  if (invoice === null) {
    throw new Error(`Invoice ${cmd.invoiceId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = sendInvoice(invoice);
  if (intents.length === 0) return { changed: false };
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
  return { changed: true };
}