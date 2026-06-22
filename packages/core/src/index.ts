// @daedalus/core — explicit public contract.
// Internals (domain factory functions, value-chain internals) are NOT exported.
// Consumers depend on this surface only. ADR-004: no `export *` — curated named exports.

// Contracts (types)
export type { DomainEvent, EventIntent } from "./domain/event.ts";
export type { Lead, LeadState } from "./domain/lead.ts";
export type { Proposal, ProposalState } from "./domain/proposal.ts";
export type { Project, ProjectState } from "./domain/project.ts";
export type { Invoice, InvoiceState } from "./domain/invoice.ts";
export type { EventStorePort } from "./application/ports/event-store.ts";
export type { CoreDeps } from "./application/deps.ts";
export type { Lineage } from "./application/lineage.ts";
export type { CreateLeadCommand } from "./application/create-lead.ts";
export type { QualifyLeadCommand } from "./application/qualify-lead.ts";
export type { DiscardLeadCommand } from "./application/discard-lead.ts";
export type { SubmitProposalCommand } from "./application/submit-proposal.ts";
export type { RejectProposalCommand } from "./application/reject-proposal.ts";
export type { ApproveProposalCommand } from "./application/approve-proposal.ts";
export type { RecordPaymentCommand } from "./application/record-payment.ts";
export type { CreateProjectCommand } from "./application/create-project.ts";
export type { DeliverProjectCommand } from "./application/deliver-project.ts";
export type { CloseProjectCommand } from "./application/close-project.ts";
export type { IssueInvoiceCommand } from "./application/issue-invoice.ts";
export type { SendInvoiceCommand } from "./application/send-invoice.ts";
export type { PayInvoiceCommand } from "./application/pay-invoice.ts";
export type { OverdueInvoiceCommand } from "./application/overdue-invoice.ts";

// Value-chain event type identifiers (the public event vocabulary)
export {
  LeadCreated,
  LeadQualified,
  LeadDiscarded,
  ProposalGenerated,
  ProposalSubmitted,
  ProposalApproved,
  ProposalRejected,
  ProjectCreated,
  ProjectDelivered,
  ProjectClosed,
  InvoiceIssued,
  InvoiceSent,
  InvoicePaid,
  InvoiceOverdue,
  PaymentReceived,
} from "./domain/value-chain.ts";

// Application kernel — modules build on these to emit lineage-bearing events
export { enrich, appendIntents, startLineage, followFrom } from "./application/lineage.ts";
export {
  projectLead,
  projectProposal,
  projectProject,
  projectInvoice,
  hasUnpaidInvoices,
} from "./application/projections.ts";

// Core use cases
export { createLeadUseCase } from "./application/create-lead.ts";
export { qualifyLeadUseCase } from "./application/qualify-lead.ts";
export { discardLeadUseCase } from "./application/discard-lead.ts";
export { submitProposalUseCase } from "./application/submit-proposal.ts";
export { rejectProposalUseCase } from "./application/reject-proposal.ts";
export { approveProposalUseCase } from "./application/approve-proposal.ts";
export { recordPaymentReceivedUseCase } from "./application/record-payment.ts";
export { createProjectUseCase } from "./application/create-project.ts";
export { markProjectDeliveredUseCase } from "./application/deliver-project.ts";
export { closeProjectUseCase } from "./application/close-project.ts";
export { issueInvoiceUseCase } from "./application/issue-invoice.ts";
export { sendInvoiceUseCase } from "./application/send-invoice.ts";
export { payInvoiceUseCase } from "./application/pay-invoice.ts";
export { markInvoiceOverdueUseCase } from "./application/overdue-invoice.ts";

// Jurisdiction Model (Spec 008) — Core capability, tenant-agnostic shape.
// The Core defines the shape; the Tenant supplies values via env vars
// (see config/tenants/tenant-0.jurisdiction.ts and Plan 008 §4.1).

// Domain types
export type {
  JurisdictionRef,
  FiscalCalendar,
  JurisdictionProfile,
} from "./domain/jurisdiction/jurisdiction-profile.ts";
export type { RuleSourceKind, RuleProvenance } from "./domain/jurisdiction/rule-provenance.ts";
export type {
  RuleSetRef,
  ObligationTrigger,
  ObligationDeadline,
  ObligationSpec,
  RuleSet,
} from "./domain/jurisdiction/rule-set.ts";
export { JurisdictionProfileChanged } from "./domain/jurisdiction/jurisdiction-profile-changed.ts";
export type { JurisdictionProfileChangedPayload } from "./domain/jurisdiction/jurisdiction-profile-changed.ts";

// Application — ports, pure functions, use case
export type { JurisdictionPort } from "./application/jurisdiction/ports/jurisdiction-port.ts";
export type { RuleSetLoaderPort } from "./application/jurisdiction/ports/rule-set-loader-port.ts";
export {
  RuleSetProvenanceMissing,
  RuleSetNotFound,
  RuleSetVersionMismatch,
} from "./application/jurisdiction/ports/rule-set-loader-port.ts";
export { validateProvenance } from "./application/jurisdiction/validate-provenance.ts";
export {
  resolveJurisdiction,
  profileRef,
  type ResolvedJurisdiction,
} from "./application/jurisdiction/resolve-jurisdiction.ts";
export { recordProfileChange } from "./application/jurisdiction/record-profile-change.ts";

// Adapters — in-memory (default + tests) and filesystem (ruleset content).
// Imported via the `./adapters` subpath (ADR-004) by composition roots.
export { InMemoryJurisdictionAdapter } from "./adapters/jurisdiction/in-memory-jurisdiction.ts";
export { FilesystemRuleSetLoaderAdapter } from "./adapters/jurisdiction/filesystem-rule-set-loader.ts";

// Policy Engine (Spec 009) — platform substrate (Core stays generic; Modules
// own policies; Tenants own parameters via env vars per Plan 008 §4.1).

// Domain types
export type { PolicySourceKind, PolicyProvenance } from "./domain/policy/policy-provenance.ts";
export type {
  PolicyRef,
  PolicyOutcome,
  PolicyMatch,
  PolicyRule,
  Policy,
  PolicyAction,
} from "./domain/policy/policy.ts";
export type { PolicyDecision } from "./domain/policy/policy-decision.ts";
export { PolicyDecisionRecorded } from "./domain/policy/policy-decision-recorded.ts";
export type { PolicyDecisionRecordedPayload } from "./domain/policy/policy-decision-recorded.ts";

// Application — ports, pure functions, use case
export type {
  PolicyEnginePort,
} from "./application/policy/ports/policy-engine-port.ts";
export type { PolicyStorePort } from "./application/policy/ports/policy-store-port.ts";
export {
  PolicyNotFound,
  PolicyProvenanceMissing,
  PolicyVersionMismatch,
} from "./application/policy/ports/policy-store-port.ts";
export { validatePolicyProvenance } from "./application/policy/validate-policy-provenance.ts";
export { defaultEvaluate } from "./application/policy/default-evaluator.ts";
export {
  evaluateAndRecordPolicy,
  type EvaluateAndRecordInput,
  type EvaluateAndRecordResult,
} from "./application/policy/evaluate-and-record-policy.ts";