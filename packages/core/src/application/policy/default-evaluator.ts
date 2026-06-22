// Pure function: defaultEvaluate (Spec 009 §7 + Plan §2).
// First-match-wins; no-match → `escalate` (Constitution §II.3 default-deny).
// Stateless. Same input + same policy = same decision.

import type {
  Policy,
  PolicyAction,
  PolicyDecision,
  PolicyRule,
} from "../../domain/policy/policy.ts";

export function defaultEvaluate(policy: Policy, action: PolicyAction): {
  decision: PolicyDecision;
  ruleId: string | null;
} {
  for (const rule of policy.rules) {
    if (matches(rule, action)) {
      const decision = decisionFromRule(rule);
      return { decision, ruleId: rule.ruleId };
    }
  }
  // No rule matched → default-deny via escalate (terminal).
  return {
    decision: { kind: "escalate", gateRef: "default", reason: "no-rule-matched" },
    ruleId: null,
  };
}

function matches(rule: PolicyRule, action: PolicyAction): boolean {
  return matchOne(rule.match, action);
}

// Shape-based discrimination. PolicyMatch is a structural union (no `kind`
// discriminator) so the JSON shape round-trips cleanly. We narrow by
// checking which named field is present on the object.
function matchOne(m: PolicyRule["match"], action: PolicyAction): boolean {
  if ("always" in m && m.always === true) return true;
  if ("actionType" in m) return action.actionType === m.actionType;
  if ("fieldEquals" in m) return readField(action, m.fieldEquals.field) === m.fieldEquals.value;
  if ("and" in m) return m.and.every((c) => matchOne(c, action));
  if ("or" in m) return m.or.some((c) => matchOne(c, action));
  return false;
}

function readField(action: PolicyAction, path: string): unknown {
  if (path === "actionType") return action.actionType;
  if (path === "tenantId") return action.tenantId;
  if (path === "actor") return action.actor;
  if (path === "occurredAt") return action.occurredAt;
  if (path === "context") return action.context;
  if (path.startsWith("context.")) {
    const segment = path.slice("context.".length);
    let cur: unknown = action.context;
    for (const part of segment.split(".")) {
      if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  }
  return undefined;
}

function decisionFromRule(rule: PolicyRule): PolicyDecision {
  switch (rule.outcome) {
    case "allow":
      return { kind: "allow", ...(rule.reason !== undefined ? { reason: rule.reason } : {}) };
    case "deny":
      return { kind: "deny", reason: rule.reason ?? "rule-matched-deny" };
    case "escalate":
      return {
        kind: "escalate",
        gateRef: rule.escalateTo ?? "default",
        reason: rule.reason ?? "rule-matched-escalate",
      };
  }
}