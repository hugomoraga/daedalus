// Tax & Compliance Guard (Spec 004) — module domain event types.
//
// Four Module-owned events cover the obligation lifecycle (due / met /
// missed / evaluated). The fifth obligation-coverage event
// (`ObligationCoverageGap`) is owned by Core (Spec 010 §12.4) and
// imported here from @daedalus/core — no duplication.
//
// All event types here are Module-internal; only the curated subset
// appears in the public contract (`src/index.ts`).

import type { RuleProvenance } from "@daedalus/core";

export const ObligationDue = "ObligationDue";
export const ObligationMet = "ObligationMet";
export const ObligationMissed = "ObligationMissed";
export const ObligationEvaluationRecorded = "ObligationEvaluationRecorded";

// A required human action — mirrors `ObligationSpec.requiredHumanAction`
// from Core. Duplicated here so the Module's payload type does not need
// to import from a Core submodule; the strings are the contract.
export type RequiredHumanAction = "notify" | "file" | "pay" | "review";

// ObligationDue — emitted when a financial event matches a RuleSet
// obligation. Carries the obligation + the trigger + the deadline +
// the rule provenance (for audit). The trigger event id is the
// causationId of the ObligationDue event itself.
export type ObligationDuePayload = {
  obligationId: string;
  obligationHumanName: string;
  triggerEventId: string;
  triggerEventType: string;
  dueAt: string; // ISO-8601 timestamp
  ruleSetId: string;
  ruleSetVersion: string;
  requiredHumanAction: RequiredHumanAction;
  provenance: RuleProvenance;
};

// ObligationMet — emitted ONLY via the human ack CLI command
// (obligations:ack). System never auto-emits it. The dueEventId links
// back to the ObligationDue event so the lineage is preserved.
export type ObligationMetPayload = {
  obligationId: string;
  dueEventId: string;
  actor: string;
  notes?: string;
};

// ObligationMissed — emitted by sweepDeadlinesUseCase when a pending
// obligation's dueAt is in the past. Idempotent (re-running the sweep
// does NOT re-emit if the obligation is already met or missed).
export type ObligationMissedPayload = {
  obligationId: string;
  dueEventId: string;
  dueAt: string;
  detectedAt: string;
};

// ObligationEvaluationRecorded — emitted whenever the tax-compliance-
// policy bundle is evaluated for an obligation (after the watcher
// matched a trigger). Carries the outcome + the rule (if any) that
// matched. When the policy bundle is absent, the watcher still emits
// this with `outcome=allow`, `reason="no-policy-bundle"`, and
// `policyRef=null` so the audit trail is complete.
export type ObligationEvaluationOutcome = "allow" | "deny" | "escalate";

export type ObligationEvaluationRecordedPayload = {
  obligationId: string;
  dueEventId: string;
  outcome: ObligationEvaluationOutcome;
  reason: string;
  policyRef: { policyId: string; version: string } | null;
  ruleId: string | null;
  gateRef?: string;
};
