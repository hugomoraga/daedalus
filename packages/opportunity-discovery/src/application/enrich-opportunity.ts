// Use case: enrich a surfaced opportunity (Spec 003 AC-2).
// Enrichment mutates the work-area AND emits an event
// (what was known at decision time is audit-relevant).

import { appendIntents, enrich, startLineage } from "@daedalus/core";
import type { OpportunityDiscoveryDeps } from "./deps.ts";
import { enrichOpportunity } from "../domain/opportunity.ts";

export type EnrichOpportunityCommand = {
  tenantId: string;
  opportunityId: string;
  description?: string;
  contact?: string;
};

export async function enrichOpportunityUseCase(
  deps: OpportunityDiscoveryDeps,
  cmd: EnrichOpportunityCommand,
): Promise<void> {
  const opportunity = await deps.opportunityStore.load(cmd.tenantId, cmd.opportunityId);
  if (opportunity === null) {
    throw new Error(`Opportunity ${cmd.opportunityId} not found in tenant ${cmd.tenantId}`);
  }
  const { opportunity: updated, events } = enrichOpportunity(opportunity, {
    description: cmd.description,
    contact: cmd.contact,
  });
  await deps.opportunityStore.save(updated);
  await appendIntents(deps, cmd.tenantId, events, startLineage(deps.newId));
}