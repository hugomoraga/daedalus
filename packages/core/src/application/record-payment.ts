// Use case: record a PaymentReceived against a Proposal.
// Idempotent on (tenantId, proposalId, paymentId): re-recording the same payment is rejected.
// Each payment is a distinct, irreversible financial fact (Constitution Article V).
//
// Note: in production this would require a human-governed approval gate. v1 keeps it manual
// via the CLI, which is sufficient for Phase 1 — the policy engine (Phase 3) will gate it later.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, enrich, startLineage } from "./lineage.ts";
import { PaymentReceived } from "../domain/value-chain.ts";

export type RecordPaymentCommand = {
  tenantId: string;
  proposalId: string;
  paymentId: string;
  amount: number;
  currency: string;
};

export async function recordPaymentReceivedUseCase(deps: CoreDeps, cmd: RecordPaymentCommand): Promise<void> {
  if (cmd.amount <= 0) {
    throw new Error("Payment amount must be positive");
  }
  if (cmd.paymentId.trim().length === 0) {
    throw new Error("paymentId is required");
  }
  const events = await deps.eventStore.readStream(cmd.tenantId);
  // Idempotent on (proposalId, paymentId): the same payment recorded twice is rejected.
  const duplicate = events.some(
    (e) =>
      e.type === PaymentReceived &&
      e.payload.proposalId === cmd.proposalId &&
      e.payload.paymentId === cmd.paymentId,
  );
  if (duplicate) {
    throw new Error(`Payment ${cmd.paymentId} for proposal ${cmd.proposalId} is already recorded`);
  }
  const lineage = startLineage(deps.newId);
  await deps.eventStore.append(
    enrich(
      {
        type: PaymentReceived,
        payload: {
          proposalId: cmd.proposalId,
          paymentId: cmd.paymentId,
          amount: cmd.amount,
          currency: cmd.currency,
        },
      },
      { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage },
    ),
  );
}