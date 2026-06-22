// ObligationCoverageGap (Spec 010 §12.4).
// Emitted by a Module (Spec 004 Tax & Compliance, or future rule
// consumers) when it finds an obligation it cannot evaluate. The system
// never invents a rule; it surfaces the gap.

import type { JurisdictionRef } from "../../../domain/jurisdiction/jurisdiction-profile.ts";

export const ObligationCoverageGap = "ObligationCoverageGap";

export type ObligationCoverageGapReason =
  | "no-rule-matches"
  | "all-matching-rules-stale"
  | "conflicting-rules-no-precedence";

export type CandidateRuleSet = {
  ruleSetId: string;
  version: string;
  effectiveFrom: string;
  jurisdiction: JurisdictionRef;
};

export type ObligationCoverageGapPayload = {
  obligationId: string;
  obligationHumanName: string;
  reason: ObligationCoverageGapReason;
  candidateRuleSets: CandidateRuleSet[];
};