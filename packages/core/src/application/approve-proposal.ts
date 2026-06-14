// Use case: approve a Proposal. Emits the Core ProposalApproved event.
// Idempotent: approving an already-approved proposal is rejected (the event is
// the source of truth, not a derived projection — no need to replay to decide).
// Note: in v1 we don't model the rejected branch; the proposal simply hasn't
// been approved. A future spec adds ProposalRejected if needed.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, enrich, startLineage } from "./lineage.ts";
import { ProposalApproved } from "../domain/value-chain.ts";

export type ApproveProposalCommand = {
  tenantId: string;
  proposalId: string;
  leadId: string;
  expectedValue: { amount: number; currency: string };
  approver?: string;
};

export async function approveProposalUseCase(deps: CoreDeps, cmd: ApproveProposalCommand): Promise<void> {
  // Replay to check idempotency: a proposal that already has ProposalApproved is rejected.
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const alreadyApproved = events.some(
    (e) => e.type === ProposalApproved && e.payload.proposalId === cmd.proposalId,
  );
  if (alreadyApproved) {
    throw new Error(`Proposal ${cmd.proposalId} is already approved`);
  }
  // Verify the proposal exists.
  const exists = events.some(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === cmd.proposalId,
  );
  if (!exists) {
    throw new Error(`Proposal ${cmd.proposalId} not found in tenant ${cmd.tenantId}`);
  }
  const lineage = startLineage(deps.newId);
  await deps.eventStore.append(
    enrich(
      {
        type: ProposalApproved,
        payload: {
          proposalId: cmd.proposalId,
          leadId: cmd.leadId,
          expectedValue: cmd.expectedValue,
          approver: cmd.approver ?? deps.actor,
        },
      },
      { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage },
    ),
  );
}