// Use case: registerRuleSetUseCase (Spec 010 §9.4 + Plan §3.1, task R-06).
// Validates the RuleSet (via validateProvenance from Spec 008) and emits
// RuleSetRegistered via Core's canonical pipeline.

import {
  appendIntents,
  startLineage,
  type CoreDeps,
  type DomainEvent,
} from "@daedalus/core";
import { RuleSetRegistered } from "../../domain/rule-source/rule-set-registered.ts";
import { validateProvenance } from "../../application/jurisdiction/validate-provenance.ts";
import type { RuleSet, RuleSetRef } from "../../domain/jurisdiction/rule-set.ts";
import type { RuleSetLoaderPort } from "../../application/jurisdiction/ports/rule-set-loader-port.ts";

export type RegisterRuleSetInput = {
  tenantId: string;
  actor: string;
  ruleSet: RuleSet;
};

export async function registerRuleSetUseCase(
  deps: CoreDeps,
  _store: RuleSetLoaderPort, // kept for future cross-checks; not used in v1
  input: RegisterRuleSetInput,
): Promise<{ event: DomainEvent; ref: RuleSetRef }> {
  validateProvenance(input.ruleSet);
  const ref: RuleSetRef = input.ruleSet.ref;
  const lineage = startLineage(deps.newId);
  const before = await deps.eventStore.readStream(input.tenantId);
  await appendIntents(
    deps,
    input.tenantId,
    [
      {
        type: RuleSetRegistered,
        payload: {
          ruleSetId: ref.ruleSetId,
          version: ref.version,
          effectiveFrom: ref.effectiveFrom,
          obligationsUri: ref.obligationsUri,
          ruleCount: input.ruleSet.obligations.length,
          provenance: ref.provenance,
        },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(input.tenantId);
  const event = after[after.length - 1];
  if (event === undefined || event.type !== RuleSetRegistered) {
    throw new Error("RuleSetRegistered not found after appendIntents");
  }
  void before;
  return { event, ref };
}