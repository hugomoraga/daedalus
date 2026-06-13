// Use case: discard a draft. Emits ProposalDraftDiscarded; no Core Proposal is created (Spec 002 AC-6).

import type { Deps } from "../shared/deps.ts";
import { appendIntents } from "../shared/lineage.ts";
import { discardDraft } from "../../domain/proposal-generation/proposal-draft.ts";

export type DiscardDraftCommand = {
  tenantId: string;
  draftId: string;
};

export async function discardDraftUseCase(deps: Deps, cmd: DiscardDraftCommand): Promise<void> {
  const draft = await deps.draftStore.load(cmd.tenantId, cmd.draftId);
  if (draft === null) {
    throw new Error(`Draft ${cmd.draftId} not found`);
  }
  const { draft: discarded, events: intents } = discardDraft(draft);
  await deps.draftStore.save(discarded);
  await appendIntents(deps, cmd.tenantId, intents);
}
