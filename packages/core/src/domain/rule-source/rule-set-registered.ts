// RuleSetRegistered (Spec 010 §12.1).
// Emitted by registerRuleSetUseCase when a founder registers a new RuleSet.
// The payload carries the minimum for audit + a future re-load.

import type { RuleProvenance } from "../../../domain/jurisdiction/rule-provenance.ts";

export const RuleSetRegistered = "RuleSetRegistered";

export type RuleSetRegisteredPayload = {
  ruleSetId: string;
  version: string;
  effectiveFrom: string;
  obligationsUri: string;
  ruleCount: number;
  provenance: RuleProvenance;
};