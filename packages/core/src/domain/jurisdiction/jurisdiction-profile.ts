// JurisdictionProfile (Spec 008 §3.1).
// Tenant-scoped declaration. Core defines the SHAPE; the Tenant supplies
// the VALUES. The Core never interprets country codes, fiscal calendars,
// currencies, or rule-set content (Constitution Principle 10).

import type { RuleSetRef } from "./rule-set.ts";

export type JurisdictionRef = {
  countryCode: string; // ISO 3166-1 alpha-2 — opaque to Core
  subdivisionCode?: string; // state / province — opaque to Core
};

export type FiscalCalendar = {
  fiscalYearStart: { month: number; day: number }; // 1-12, 1-31
  filingCadence: "monthly" | "quarterly" | "annual" | "custom";
};

export type JurisdictionProfile = {
  jurisdiction: JurisdictionRef;
  calendar: FiscalCalendar;
  currency: string; // ISO 4217 — opaque to Core
  ruleSets: RuleSetRef[];
  effectiveFrom?: string; // ISO date — when this profile became active
};