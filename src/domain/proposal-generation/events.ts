// Proposal Generation — module domain event types.
// Per Spec 002 §6: only deliberate milestones emit events. Editing a draft emits nothing.

export const ProposalDraftCreated = "ProposalDraftCreated";
export const ProposalDraftFinalized = "ProposalDraftFinalized";
export const ProposalDraftDiscarded = "ProposalDraftDiscarded";
