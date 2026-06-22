// RuleSetSuperseded (Spec 010 §12.2).
// Emitted when a new version of a RuleSet activates. The new
// RuleSetRegistered and this event share correlationId so audit can
// link them. The old version remains queryable for audit.

export const RuleSetSuperseded = "RuleSetSuperseded";

export type RuleSetSupersededPayload = {
  ruleSetId: string;
  previousVersion: string;
  newVersion: string;
  previousEffectiveFrom: string;
  newEffectiveFrom: string;
};