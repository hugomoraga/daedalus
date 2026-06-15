// Core value-chain domain event types (tenant-agnostic).
// The first reference workflow: Lead -> Proposal -> ... (see ADR-001 — this is a
// reference workflow, NOT the universal ontology of Daedalus).

export const LeadCreated = "LeadCreated";
export const LeadQualified = "LeadQualified";
export const LeadDiscarded = "LeadDiscarded";
export const ProposalGenerated = "ProposalGenerated";
export const ProposalSubmitted = "ProposalSubmitted";
export const ProposalApproved = "ProposalApproved";
export const ProposalRejected = "ProposalRejected";
export const ProjectCreated = "ProjectCreated";
export const ProjectDelivered = "ProjectDelivered";
export const ProjectClosed = "ProjectClosed";
export const InvoiceIssued = "InvoiceIssued";
export const InvoiceSent = "InvoiceSent";
export const InvoicePaid = "InvoicePaid";
export const InvoiceOverdue = "InvoiceOverdue";
export const PaymentReceived = "PaymentReceived";
