// Use case: create a Lead (Core seed — minimal, not a CRM).

import type { Deps } from "../shared/deps.ts";
import { appendIntents } from "../shared/lineage.ts";
import { createLead } from "../../domain/core/lead.ts";

export type CreateLeadCommand = {
  tenantId: string;
  customer: string;
};

export async function createLeadUseCase(deps: Deps, cmd: CreateLeadCommand): Promise<{ leadId: string }> {
  const { lead, events } = createLead(deps.newId(), cmd.customer);
  await appendIntents(deps, cmd.tenantId, events);
  return { leadId: lead.id };
}
