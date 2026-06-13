// Use case: finalize a draft. Emits the module milestone ProposalDraftFinalized AND
// exactly one CORE ProposalGenerated carrying the expectedValue contract (Spec 002 AC-5, R1).
// The Module owns the draft; the Core owns the Proposal from ProposalGenerated onward.

import { appendIntents, enrich, startLineage, ProposalGenerated } from "@daedalus/core";
import type { ProposalDeps } from "./deps.ts";
import type { ExpectedValue } from "../domain/value-objects.ts";
import { finalizeDraft } from "../domain/proposal-draft.ts";

export type FinalizeDraftCommand = {
  tenantId: string;
  draftId: string;
  currency: string;
};

export async function finalizeDraftUseCase(
  deps: ProposalDeps,
  cmd: FinalizeDraftCommand,
): Promise<{ proposalId: string; expectedValue: ExpectedValue }> {
  const draft = await deps.draftStore.load(cmd.tenantId, cmd.draftId);
  if (draft === null) {
    throw new Error(`Draft ${cmd.draftId} not found`);
  }

  const { draft: finalized, expectedValue, events: intents } = finalizeDraft(draft, cmd.currency);
  await deps.draftStore.save(finalized);

  // One lineage for the whole finalize flow: the module milestone and the Core handoff
  // share a correlationId, so the proposal's creation can be followed end to end.
  const lineage = startLineage(deps.newId);

  // Module milestone.
  await appendIntents(deps, cmd.tenantId, intents, lineage);

  // Core handoff: a single ProposalGenerated carrying the expectedValue contract
  // for Revenue Visibility (Spec 001) to consume later.
  const proposalId = deps.newId();
  await deps.eventStore.append(
    enrich(
      {
        type: ProposalGenerated,
        payload: { proposalId, leadId: draft.leadId, draftId: draft.id, expectedValue },
      },
      { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage },
    ),
  );

  return { proposalId, expectedValue };
}
