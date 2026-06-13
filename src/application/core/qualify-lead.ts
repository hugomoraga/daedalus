// Use case: qualify a Lead. Replays events to rebuild the lead before deciding.

import type { Deps } from "../shared/deps.ts";
import { appendIntents } from "../shared/lineage.ts";
import { qualifyLead } from "../../domain/core/lead.ts";
import { projectLead } from "./projections.ts";

export type QualifyLeadCommand = {
  tenantId: string;
  leadId: string;
};

export async function qualifyLeadUseCase(deps: Deps, cmd: QualifyLeadCommand): Promise<void> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const lead = projectLead(events, cmd.leadId);
  if (lead === null) {
    throw new Error(`Lead ${cmd.leadId} not found in tenant ${cmd.tenantId}`);
  }
  const intents = qualifyLead(lead);
  await appendIntents(deps, cmd.tenantId, intents);
}
