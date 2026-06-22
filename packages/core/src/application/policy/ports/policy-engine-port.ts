// PolicyEnginePort (Spec 009 §4) — the engine's evaluation entry point.
// The port separates the mechanics (load + evaluate + record) from the
// concrete evaluator implementation (default or Module-supplied).
//
// The default implementation is `evaluateAndRecordPolicy` (below); it
// loads via PolicyStorePort, runs the built-in first-match-wins evaluator,
// and records PolicyDecisionRecorded via Core's event store.

import type {
  PolicyAction,
  PolicyDecision,
  PolicyRef,
} from "../../../domain/policy/policy.ts";
import type { PolicyStorePort } from "./policy-store-port.ts";

export interface PolicyEnginePort {
  evaluateAndRecord(input: {
    tenantId: string;
    actor: string;
    policyRef: PolicyRef;
    action: PolicyAction;
  }): Promise<PolicyDecision>;
}

// Re-export the store port here so callers that need both ports can
// import from a single file.
export type { PolicyStorePort };