// Use case: start a proposal draft from a QUALIFIED lead (Spec 002 AC-1).

import type { Deps } from "../shared/deps.ts";
import { appendIntents } from "../shared/lineage.ts";
import { projectLead } from "../core/projections.ts";
import { startDraft } from "../../domain/proposal-generation/proposal-draft.ts";

export type StartDraftCommand = {
  tenantId: string;
  leadId: string;
  template: string;
};

export async function startDraftUseCase(deps: Deps, cmd: StartDraftCommand): Promise<{ draftId: string }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const lead = projectLead(events, cmd.leadId);
  if (lead === null) {
    throw new Error(`Lead ${cmd.leadId} not found`);
  }
  if (lead.state !== "qualified") {
    throw new Error(`Lead ${cmd.leadId} is not qualified; a draft can only start from a qualified lead`);
  }
  const { draft, events: intents } = startDraft(deps.newId(), cmd.tenantId, cmd.leadId, cmd.template);
  await deps.draftStore.save(draft);
  await appendIntents(deps, cmd.tenantId, intents);
  return { draftId: draft.id };
}
