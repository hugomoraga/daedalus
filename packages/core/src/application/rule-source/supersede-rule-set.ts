// Use case: supersedeRuleSetUseCase (Spec 010 §9.4 + Plan §3.2, task R-07).
// Emits RuleSetSuperseded linking the previous and new versions. The
// caller passes the new RuleSetRegistered's correlationId so audit can
// link the two events.

import {
  appendIntents,
  startLineage,
  type CoreDeps,
  type DomainEvent,
} from "@daedalus/core";
import { RuleSetSuperseded } from "../../domain/rule-source/rule-set-superseded.ts";

export type SupersedeRuleSetInput = {
  tenantId: string;
  actor: string;
  ruleSetId: string;
  previousVersion: string;
  newVersion: string;
  previousEffectiveFrom: string;
  newEffectiveFrom: string;
  // The new RuleSetRegistered's correlationId — links the two events
  // in the audit trail. Optional; if absent, a fresh correlation.
  correlationId?: string;
};

export async function supersedeRuleSetUseCase(
  deps: CoreDeps,
  input: SupersedeRuleSetInput,
): Promise<{ event: DomainEvent }> {
  const lineage = input.correlationId !== undefined
    ? { correlationId: input.correlationId, causationId: null }
    : startLineage(deps.newId);
  const before = await deps.eventStore.readStream(input.tenantId);
  await appendIntents(
    deps,
    input.tenantId,
    [
      {
        type: RuleSetSuperseded,
        payload: {
          ruleSetId: input.ruleSetId,
          previousVersion: input.previousVersion,
          newVersion: input.newVersion,
          previousEffectiveFrom: input.previousEffectiveFrom,
          newEffectiveFrom: input.newEffectiveFrom,
        },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(input.tenantId);
  const event = after[after.length - 1];
  if (event === undefined || event.type !== RuleSetSuperseded) {
    throw new Error("RuleSetSuperseded not found after appendIntents");
  }
  void before;
  return { event };
}