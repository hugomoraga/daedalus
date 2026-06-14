// Use case: surface a new opportunity (Spec 003 AC-1).
// Creates the opportunity work-area and emits OpportunitySurfaced.

import { appendIntents, startLineage } from "@daedalus/core";
import type { OpportunityDiscoveryDeps } from "./deps.ts";
import { surfaceOpportunity } from "../domain/opportunity.ts";

export type SurfaceOpportunityCommand = {
  tenantId: string;
  label: string;
  source: string;
};

export async function surfaceOpportunityUseCase(
  deps: OpportunityDiscoveryDeps,
  cmd: SurfaceOpportunityCommand,
): Promise<{ opportunityId: string }> {
  const id = deps.newId();
  const { opportunity, events } = surfaceOpportunity(id, cmd.tenantId, cmd.label, cmd.source);
  await deps.opportunityStore.save(opportunity);
  await appendIntents(deps, cmd.tenantId, events, startLineage(deps.newId));
  return { opportunityId: opportunity.id };
}