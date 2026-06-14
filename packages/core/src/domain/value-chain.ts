// Core value-chain domain event types (tenant-agnostic).
// The first reference workflow: Lead -> Proposal -> ... (see ADR-001 — this is a
// reference workflow, NOT the universal ontology of Daedalus).

export const LeadCreated = "LeadCreated";
export const LeadQualified = "LeadQualified";
export const LeadDiscarded = "LeadDiscarded";
export const ProposalGenerated = "ProposalGenerated";
