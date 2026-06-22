// @daedalus/tax-compliance-guard — explicit public contract.
//
// The Module is a guard, not an engine (Spec 004 §13 Compliance Flag).
// It watches financial events, computes deadlines, and emits obligation
// lifecycle events. It owns no jurisdiction-specific content; that lives
// in Tenant RuleSets (Spec 010 process) and the tax-compliance-policy
// bundle (Spec 009).
//
// Internals (use-case wiring, lineage helpers) are NOT exported.
// Consumers depend on this surface only. ADR-004: no `export *`.

// Domain event-type constants + payload types
export {
  ObligationDue,
  ObligationMet,
  ObligationMissed,
  ObligationEvaluationRecorded,
  type ObligationDuePayload,
  type ObligationMetPayload,
  type ObligationMissedPayload,
  type ObligationEvaluationRecordedPayload,
  type ObligationEvaluationOutcome,
  type RequiredHumanAction,
} from "./domain/obligation.ts";

// Use cases
export {
  watchFinancialEventsUseCase,
  type WatchFinancialEventsInput,
  type WatchFinancialEventsResult,
} from "./application/watch-financial-events.ts";

export {
  sweepDeadlinesUseCase,
  type SweepDeadlinesInput,
  type SweepDeadlinesResult,
} from "./application/sweep-deadlines.ts";

export {
  acknowledgeObligationUseCase,
  ObligationNotPending,
  UnknownObligation,
  type AcknowledgeObligationInput,
  type AcknowledgeObligationResult,
} from "./application/acknowledge-obligation.ts";

export {
  listObligationsUseCase,
  type ListObligationsInput,
  type ListObligationsResult,
} from "./application/list-obligations.ts";

export {
  evaluateTaxPolicyUseCase,
  DEFAULT_TAX_COMPLIANCE_POLICY_REF,
  toObligationEvaluationPayload,
  type EvaluateTaxPolicyInput,
  type EvaluateTaxPolicyResult,
} from "./application/evaluate-tax-policy.ts";

// Pure helpers
export { computeDeadline } from "./application/compute-deadline.ts";
export {
  deriveObligationStates,
  type ObligorState,
  type ObligationState,
} from "./application/obligation-state.ts";

// Module deps shape
export type { TaxComplianceDeps } from "./application/deps.ts";
