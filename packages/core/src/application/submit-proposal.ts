// Use case: submit a Proposal. Idempotent.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { submitProposal } from "../domain/proposal.ts";
import { projectProposal } from "./projections.ts";

export type SubmitProposalCommand = {
  tenantId: string;
  proposalId: string;
};

export async function submitProposalUseCase(
  deps: CoreDeps,
  cmd: SubmitProposalCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const proposal = projectProposal(events, cmd.proposalId);
  if (proposal === null) {
    throw new Error(`Proposal ${cmd.proposalId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = submitProposal(proposal);
  if (intents.length === 0) return { changed: false };
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
  return { changed: true };
}