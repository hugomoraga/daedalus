// Opportunity Discovery — port for the mutable work-area.
// Per Spec 003, the live state of an opportunity is a mutable work-area
// (like the ProposalDraft). Only milestone transitions emit events,
// but enrichment also persists to this store AND emits an event.

export interface OpportunityStorePort {
  load(tenantId: string, opportunityId: string): Promise<import("../domain/opportunity.ts").Opportunity | null>;
  save(opportunity: import("../domain/opportunity.ts").Opportunity): Promise<void>;
}