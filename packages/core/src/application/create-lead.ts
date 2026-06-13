// Use case: create a Lead (Core seed — minimal, not a CRM).

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { createLead } from "../domain/lead.ts";

export type CreateLeadCommand = {
  tenantId: string;
  customer: string;
};

export async function createLeadUseCase(deps: CoreDeps, cmd: CreateLeadCommand): Promise<{ leadId: string }> {
  const { lead, events } = createLead(deps.newId(), cmd.customer);
  await appendIntents(deps, cmd.tenantId, events, startLineage(deps.newId));
  return { leadId: lead.id };
}
