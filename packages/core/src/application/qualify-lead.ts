// Use case: qualify a Lead. Replays events to rebuild the lead before deciding.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { qualifyLead } from "../domain/lead.ts";
import { projectLead } from "./projections.ts";

export type QualifyLeadCommand = {
  tenantId: string;
  leadId: string;
};

export async function qualifyLeadUseCase(deps: CoreDeps, cmd: QualifyLeadCommand): Promise<void> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const lead = projectLead(events, cmd.leadId);
  if (lead === null) {
    throw new Error(`Lead ${cmd.leadId} not found in tenant ${cmd.tenantId}`);
  }
  const intents = qualifyLead(lead);
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
}
