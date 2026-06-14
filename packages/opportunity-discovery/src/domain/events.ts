// Opportunity Discovery — module domain event types.
// Per Spec 003 §6: only deliberate milestones emit events.
// Enrichment is event-worthy because it records what was known at decision time.

export const OpportunitySurfaced = "OpportunitySurfaced";
export const OpportunityEnriched = "OpportunityEnriched";
export const OpportunityQualified = "OpportunityQualified";
export const OpportunityDismissed = "OpportunityDismissed";