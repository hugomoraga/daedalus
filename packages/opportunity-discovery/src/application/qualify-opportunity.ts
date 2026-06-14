// Use case: qualify a surfaced opportunity (Spec 003 AC-3 — the key composition).
// Emits the module milestone OpportunityQualified AND Core LeadCreated + LeadQualified
// with shared lineage (same pattern as ProposalDraftFinalized + ProposalGenerated).
// The module owns the Opportunity; the Core owns the Lead from this point onward.

import { appendIntents, enrich, startLineage, LeadCreated, LeadQualified } from "@daedalus/core";
import type { OpportunityDiscoveryDeps } from "./deps.ts";
import { qualifyOpportunity } from "../domain/opportunity.ts";
import { projectLead } from "@daedalus/core";

export type QualifyOpportunityCommand = {
  tenantId: string;
  opportunityId: string;
};

export async function qualifyOpportunityUseCase(
  deps: OpportunityDiscoveryDeps,
  cmd: QualifyOpportunityCommand,
): Promise<{ leadId: string }> {
  const opportunity = await deps.opportunityStore.load(cmd.tenantId, cmd.opportunityId);
  if (opportunity === null) {
    throw new Error(`Opportunity ${cmd.opportunityId} not found in tenant ${cmd.tenantId}`);
  }

  const leadId = deps.newId();
  const { opportunity: qualified, events: moduleEvents } = qualifyOpportunity(opportunity, leadId);
  await deps.opportunityStore.save(qualified);

  // One lineage for the whole qualification flow: module milestone + Core handoff
  // share a correlationId, so the handoff can be followed end to end.
  const lineage = startLineage(deps.newId);

  // Module milestone.
  await appendIntents(deps, cmd.tenantId, moduleEvents, lineage);

  // Core handoff: LeadCreated (carrying opportunityId for lineage) + LeadQualified.
  // LeadQualified is caused by LeadCreated (the lead exists before it can be qualified).
  const leadCreatedEvent = enrich(
    {
      type: LeadCreated,
      payload: { leadId, customer: opportunity.label, opportunityId: opportunity.id },
    },
    { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage },
  );
  await deps.eventStore.append(leadCreatedEvent);

  await deps.eventStore.append(
    enrich(
      { type: LeadQualified, payload: { leadId } },
      { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage: { correlationId: lineage.correlationId, causationId: leadCreatedEvent.eventId } },
    ),
  );

  return { leadId };
}