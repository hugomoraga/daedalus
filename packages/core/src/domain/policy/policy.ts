// Policy artifact shape (Spec 009 §3.1 + §3.2).
// A versioned JSON document. Core defines the SHAPE; Modules author
// POLICIES; Tenants can override parameters (per Plan 008 §4.1 env-var
// pattern). The Core reads; it does not write.

import type { PolicyProvenance } from "./policy-provenance.ts";

// Reference to a policy — opaque to the engine mechanics. The rules
// themselves live behind `rulesUri` and are loaded by PolicyStorePort.
export type PolicyRef = {
  policyId: string;
  version: string; // semver — opaque
  effectiveFrom: string; // ISO date
  provenance: PolicyProvenance;
  rulesUri: string;
};

// The 3-outcome verdict (Spec 009 §3.4 + §11 Q1). Exact three values.
export type PolicyOutcome = "allow" | "deny" | "escalate";

// A predicate over the action context. v1 supports a small tagged union.
// Richer languages (DSL, regex, etc.) are explicitly future.
export type PolicyMatch =
  | { actionType: string }
  | { fieldEquals: { field: string; value: unknown } }
  | { and: PolicyMatch[] }
  | { or: PolicyMatch[] }
  | { always: true };

export type PolicyRule = {
  ruleId: string;
  match: PolicyMatch;
  outcome: PolicyOutcome;
  // For `escalate`: which human gate should the action route to? Opaque
  // string the operator surface interprets.
  escalateTo?: string;
  reason?: string;
};

export type Policy = {
  ref: PolicyRef;
  rules: PolicyRule[];
};

// The action being evaluated. Modules construct PolicyActions from their
// own events (Spec 004's ObligationMissed is the first canonical case).
export type PolicyAction = {
  actionType: string; // e.g. "ObligationMissed", "ProjectClosed"
  tenantId: string;
  actor: string;
  context: Record<string, unknown>;
  occurredAt: string; // ISO date
};