// Use case: evaluateAndRecordPolicy (Spec 009 §4, Plan §3, task P-08).
// Loads the policy via PolicyStorePort, runs the default evaluator,
// records PolicyDecisionRecorded via Core's canonical pipeline, and
// returns the verdict. The caller decides what to do with it.

import {
  appendIntents,
  startLineage,
  type CoreDeps,
  type DomainEvent,
} from "@daedalus/core";
import { PolicyDecisionRecorded } from "../../domain/policy/policy-decision-recorded.ts";
import type { PolicyDecision } from "../../domain/policy/policy-decision.ts";
import { defaultEvaluate } from "./default-evaluator.ts";
import type { PolicyEnginePort } from "./ports/policy-engine-port.ts";
import type { PolicyStorePort } from "./ports/policy-store-port.ts";

export type EvaluateAndRecordInput = {
  tenantId: string;
  actor: string;
  policyRef: {
    policyId: string;
    version: string;
    effectiveFrom: string;
    provenance: import("../../domain/policy/policy-provenance.ts").PolicyProvenance;
    rulesUri: string;
  };
  action: import("../../domain/policy/policy.ts").PolicyAction;
};

export type EvaluateAndRecordResult = {
  decision: PolicyDecision;
  ruleId: string | null;
  event: DomainEvent;
};

// Default policy engine: load + defaultEvaluate + record. A future Spec
// may supply a Module-level custom evaluator via this same port.
export async function evaluateAndRecordPolicy(
  deps: CoreDeps,
  store: PolicyStorePort,
  input: EvaluateAndRecordInput,
): Promise<EvaluateAndRecordResult> {
  const policy = await store.load(input.policyRef, input.tenantId);
  const { decision, ruleId } = defaultEvaluate(policy, input.action);
  const lineage = startLineage(deps.newId);
  const before = await deps.eventStore.readStream(input.tenantId);
  await appendIntents(
    deps,
    input.tenantId,
    [
      {
        type: PolicyDecisionRecorded,
        payload: {
          policyRef: {
            policyId: input.policyRef.policyId,
            version: input.policyRef.version,
          },
          action: {
            actionType: input.action.actionType,
            context: input.action.context,
          },
          outcome: decision,
          provenance: policy.ref.provenance,
          ruleId,
        },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(input.tenantId);
  const event = after[after.length - 1];
  if (event === undefined || event.type !== PolicyDecisionRecorded) {
    throw new Error("PolicyDecisionRecorded not found after appendIntents");
  }
  void before;
  return { decision, ruleId, event };
}

// Port adapter — lets callers type-check against PolicyEnginePort.
export const defaultPolicyEngine: PolicyEnginePort = {
  evaluateAndRecord: () => {
    throw new Error("defaultPolicyEngine.evaluateAndRecord requires deps + store; use evaluateAndRecordPolicy() instead");
  },
};