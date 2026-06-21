// PolicyDecisionPort — seam between the Workflow Engine and a policy engine
// (Spec 008 §7.8, AC-9). In v0 the implementation is a no-op that returns
// `allow`; Phase 3's policy engine plugs in here without restructuring.

import type { DomainEvent } from "@daedalus/core";
import type { Instance } from "../../domain/instance.ts";
import type { Transition } from "../../domain/workflow.ts";

export type PolicyDecision =
  | { allow: true }
  | { allow: false; reason: string };

export interface PolicyDecisionPort {
  decide(
    transition: Transition,
    event: DomainEvent,
    instance: Instance,
  ): Promise<PolicyDecision>;
}

// v0 default: every transition is allowed. The seam is exercised (AC-9).
export const noOpPolicy: PolicyDecisionPort = {
  decide: async () => ({ allow: true }),
};

// Test double: denies every transition with the given reason. Useful for AC-9
// "denial returns HumanApprovalRequired".
export function denyAllPolicy(reason = "deny-all"): PolicyDecisionPort {
  return {
    decide: async () => ({ allow: false, reason }),
  };
}