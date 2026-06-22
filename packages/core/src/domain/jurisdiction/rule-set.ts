// RuleSet + ObligationSpec (Spec 008 §3.2).
// Core defines the SHAPE; the Tenant supplies the CONTENT.
// The Core never evaluates an obligation — interpretation belongs in the
// Tax & Compliance Module (Spec 004).

import type { FiscalCalendar } from "./jurisdiction-profile.ts";
import type { RuleProvenance } from "./rule-provenance.ts";

// Reference to a rule set — opaque to Core. The actual obligations live
// behind `obligationsUri` and are loaded by the RuleSetLoaderPort.
export type RuleSetRef = {
  ruleSetId: string;
  version: string; // semver or date
  effectiveFrom: string; // ISO 8601 date
  source: RuleProvenance;
  obligationsUri: string; // e.g. "config/rulesets/<tenant>/<ruleset>@<version>.json"
};

// Trigger: an event of `onEventType` fires the obligation (subject to
// optional opaque `conditions` predicate).
export type ObligationTrigger = {
  onEventType: string;
  conditions?: Record<string, unknown>;
};

// Deadline: either a number of days after the trigger, or a fixed
// calendar date. The Core does not interpret either; the Module does.
export type ObligationDeadline =
  | { kind: "offset-from-trigger"; daysAfter: number; businessDaysOnly: boolean }
  | {
      kind: "fixed-calendar";
      month: number;
      day: number;
      cadence: FiscalCalendar["filingCadence"];
    };

// The system GUARDS; it does not FILE. `requiredHumanAction` is a hint to
// the UI / alerting layer; the Module emits a structured human task.
export type ObligationSpec = {
  obligationId: string;
  humanName: string;
  trigger: ObligationTrigger;
  deadline: ObligationDeadline;
  requiredHumanAction: "notify" | "file" | "pay" | "review";
  provenance: RuleProvenance;
};

// A loaded rule set: its ref + the obligations it contains.
export type RuleSet = {
  ref: RuleSetRef;
  obligations: ObligationSpec[];
};