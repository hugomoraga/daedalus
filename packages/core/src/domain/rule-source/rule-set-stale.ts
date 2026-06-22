// RuleSetStale (Spec 010 §12.3).
// Emitted by sweepStalenessUseCase when a RuleSet's retrievedAt exceeds
// the configured threshold for its sourceKind. A *notification*, not a
// block — the Tenant decides what to do.

import type { RuleSourceKind } from "../../../domain/jurisdiction/rule-provenance.ts";

export const RuleSetStale = "RuleSetStale";

export type RuleSetStalePayload = {
  ruleSetId: string;
  version: string;
  sourceKind: RuleSourceKind;
  retrievedAt: string;
  ageMonths: number;
  thresholdMonths: number;
};