// Use case: issue an Invoice for a delivered Project. Reactor pattern.
// Idempotent on projectId: a second invocation for the same project is a no-op.
// Cross-aggregate invariant: the project must be in 'delivered' state.

import { appendIntents, enrich, followFrom, ProjectDelivered, startLineage } from "@daedalus/core";
import type { CoreDeps } from "./deps.ts";
import { issueInvoice } from "../domain/invoice.ts";
import { projectProject } from "./projections.ts";

export type IssueInvoiceCommand = {
  tenantId: string;
  projectId: string;
};

export async function issueInvoiceUseCase(
  deps: CoreDeps,
  cmd: IssueInvoiceCommand,
): Promise<{ created: boolean; invoiceId?: string }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);

  // Idempotency: skip if an Invoice already exists for this project.
  const already = events.some(
    (e) => e.type === "InvoiceIssued" && e.payload.projectId === cmd.projectId,
  );
  if (already) return { created: false };

  // Find the source ProjectDelivered event for lineage.
  const source = events.find(
    (e) => e.type === ProjectDelivered && e.payload.projectId === cmd.projectId,
  );
  if (source === undefined) {
    throw new Error(
      `Project ${cmd.projectId} has not been delivered; cannot issue Invoice (AC-8)`,
    );
  }
  const project = projectProject(events, cmd.projectId);
  if (project === null || project.state !== "delivered") {
    throw new Error(`Project ${cmd.projectId} is not in 'delivered' state`);
  }

  const invoiceId = deps.newId();
  const { invoice, events: intents } = issueInvoice({
    id: invoiceId,
    tenantId: cmd.tenantId,
    projectId: cmd.projectId,
    proposalId: project.proposalId,
    amount: project.expectedValue.amount,
    currency: project.expectedValue.currency,
  });
  void invoice;

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
  return { created: true, invoiceId };
}