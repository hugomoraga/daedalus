// Use case: mark an Invoice as overdue. Idempotent (re-flagging emits a new fact each time).

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { overdueInvoice } from "../domain/invoice.ts";
import { projectInvoice } from "./projections.ts";

export type OverdueInvoiceCommand = {
  tenantId: string;
  invoiceId: string;
};

export async function markInvoiceOverdueUseCase(
  deps: CoreDeps,
  cmd: OverdueInvoiceCommand,
): Promise<void> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const invoice = projectInvoice(events, cmd.invoiceId);
  if (invoice === null) {
    throw new Error(`Invoice ${cmd.invoiceId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = overdueInvoice(invoice);
  if (intents.length === 0) return;
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
}