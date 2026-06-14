// Use case: dismiss a surfaced opportunity (Spec 003 AC-4).
// Emits OpportunityDismissed with the reason. No Core Lead is created.

import { appendIntents, startLineage } from "@daedalus/core";
import type { OpportunityDiscoveryDeps } from "./deps.ts";
import { dismissOpportunity } from "../domain/opportunity.ts";

export type DismissOpportunityCommand = {
  tenantId: string;
  opportunityId: string;
  reason: string;
};

export async function dismissOpportunityUseCase(
  deps: OpportunityDiscoveryDeps,
  cmd: DismissOpportunityCommand,
): Promise<void> {
  const opportunity = await deps.opportunityStore.load(cmd.tenantId, cmd.opportunityId);
  if (opportunity === null) {
    throw new Error(`Opportunity ${cmd.opportunityId} not found in tenant ${cmd.tenantId}`);
  }

  const { opportunity: dismissed, events } = dismissOpportunity(opportunity, cmd.reason);
  await deps.opportunityStore.save(dismissed);
  await appendIntents(deps, cmd.tenantId, events, startLineage(deps.newId));
}