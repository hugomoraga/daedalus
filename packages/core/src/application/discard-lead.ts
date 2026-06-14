// Use case: discard a Lead. Completes the Lead lifecycle (per Event Catalog).

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { discardLead } from "../domain/lead.ts";
import { projectLead } from "./projections.ts";

export type DiscardLeadCommand = {
  tenantId: string;
  leadId: string;
  reason: string;
};

export async function discardLeadUseCase(deps: CoreDeps, cmd: DiscardLeadCommand): Promise<void> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const lead = projectLead(events, cmd.leadId);
  if (lead === null) {
    throw new Error(`Lead ${cmd.leadId} not found in tenant ${cmd.tenantId}`);
  }
  const intents = discardLead(lead, cmd.reason);
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
}