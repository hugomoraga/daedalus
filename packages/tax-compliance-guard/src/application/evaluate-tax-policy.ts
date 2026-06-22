// Tax & Compliance Guard — evaluateTaxPolicyUseCase (Spec 004 Plan §3.5,
// T-09). Wraps Core's evaluateAndRecordPolicy (Spec 009) with the
// tax-compliance default: if the tax-compliance-policy bundle is absent
// for the tenant, default to outcome=allow with reason="no-policy-bundle"
// (Spec 004 §6, Plan §0 Q3). The watcher (not this use case) emits the
// ObligationEvaluationRecorded event with proper lineage from the trigger.

import {
  evaluateAndRecordPolicy,
  type CoreDeps,
  type PolicyAction,
  type PolicyDecision,
  type PolicyRef,
  type PolicyStorePort,
} from "@daedalus/core";
import type { ObligationEvaluationOutcome, ObligationEvaluationRecordedPayload } from "../domain/obligation.ts";
import type { TaxComplianceDeps } from "./deps.ts";

export type EvaluateTaxPolicyInput = {
  tenantId: string;
  obligation: { obligationId: string; requiredHumanAction: string };
  trigger: { eventId: string; eventType: string; occurredAt: string };
  actor: string;
  policyRef?: PolicyRef;
};

export type EvaluateTaxPolicyResult = {
  outcome: ObligationEvaluationOutcome;
  reason: string;
  policyRef: { policyId: string; version: string } | null;
  ruleId: string | null;
  gateRef?: string;
};

// The default policy reference used when the caller does not supply one.
// Modules should not hardcode jurisdiction content; the reference here
// is an ID/version (Tenant-supplied via config), not a rate or rule.
// Tests / CLI override via the `policyRef` arg.
export const DEFAULT_TAX_COMPLIANCE_POLICY_REF: PolicyRef = {
  policyId: "tax-compliance",
  version: "1.0.0",
  effectiveFrom: "2026-01-01",
  provenance: {
    sourceKind: "tenant-declared",
    sourceId: "tax-compliance-default-v1",
    retrievedAt: "2026-01-01",
    verifiedBy: "tenant",
  },
  rulesUri: "config/policies/<tenant>/tax-compliance@1.0.0.json",
};

export async function evaluateTaxPolicyUseCase(
  deps: TaxComplianceDeps,
  input: EvaluateTaxPolicyInput,
): Promise<EvaluateTaxPolicyResult> {
  const policyRef = input.policyRef ?? DEFAULT_TAX_COMPLIANCE_POLICY_REF;
  const action: PolicyAction = {
    actionType: "ObligationDue",
    tenantId: input.tenantId,
    actor: input.actor,
    context: {
      obligationId: input.obligation.obligationId,
      requiredHumanAction: input.obligation.requiredHumanAction,
      triggerEventId: input.trigger.eventId,
      triggerEventType: input.trigger.eventType,
    },
    occurredAt: input.trigger.occurredAt,
  };

  let decision: PolicyDecision;
  let ruleId: string | null;
  try {
    const result = await evaluateAndRecordPolicy(
      deps as CoreDeps,
      deps.policyStore as PolicyStorePort,
      {
        tenantId: input.tenantId,
        actor: input.actor,
        policyRef,
        action,
      },
    );
    decision = result.decision;
    ruleId = result.ruleId;
  } catch (e) {
    // No bundle for this tenant (the policy store throws on miss) →
    // default allow with reason="no-policy-bundle" (Spec 004 §6).
    if (e instanceof Error && (e.name === "PolicyProvenanceMissing" || e.name === "PolicyNotFound")) {
      return {
        outcome: "allow",
        reason: "no-policy-bundle",
        policyRef: null,
        ruleId: null,
      };
    }
    throw e;
  }

  const result: EvaluateTaxPolicyResult = {
    outcome: decision.kind,
    reason: reasonOf(decision),
    policyRef: { policyId: policyRef.policyId, version: policyRef.version },
    ruleId,
  };
  if (decision.kind === "escalate") result.gateRef = decision.gateRef;
  return result;
}

function reasonOf(d: PolicyDecision): string {
  switch (d.kind) {
    case "allow":
      return d.reason ?? "policy-allow";
    case "deny":
      return d.reason;
    case "escalate":
      return d.reason;
  }
}

// Convenience: build the ObligationEvaluationRecorded payload from a
// decision. Watcher uses this after it has the trigger DomainEvent so
// it can attach lineage via followFrom.
export function toObligationEvaluationPayload(
  obligationId: string,
  dueEventId: string,
  result: EvaluateTaxPolicyResult,
): ObligationEvaluationRecordedPayload {
  const payload: ObligationEvaluationRecordedPayload = {
    obligationId,
    dueEventId,
    outcome: result.outcome,
    reason: result.reason,
    policyRef: result.policyRef,
    ruleId: result.ruleId,
  };
  if (result.gateRef !== undefined) payload.gateRef = result.gateRef;
  return payload;
}
