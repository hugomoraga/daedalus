// Domain event: PolicyDecisionRecorded (Spec 009 §8).
// Emitted by the engine after every evaluation, regardless of outcome
// (Principle 4: Auditability by Default). Full lineage per ADR-004.

import type { PolicyDecision } from "./policy-decision.ts";
import type { PolicyProvenance } from "./policy-provenance.ts";

export const PolicyDecisionRecorded = "PolicyDecisionRecorded";

export type PolicyDecisionRecordedPayload = {
  policyRef: { policyId: string; version: string };
  action: {
    actionType: string;
    context: Record<string, unknown>;
  };
  outcome: PolicyDecision;
  provenance: PolicyProvenance;
  // Which rule fired (null when no-rule-matched → default escalate).
  ruleId: string | null;
};