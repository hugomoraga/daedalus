// RuleProvenance (Spec 008 §3.3) — mandatory metadata for every rule.
// Every rule MUST carry provenance; missing provenance is a hard error
// (validated by validateProvenance in application/jurisdiction/).

export const RULE_SOURCE_KINDS = [
  "official-publication",
  "legal-advisor-opinion",
  "tenant-declared",
] as const;

export type RuleSourceKind = (typeof RULE_SOURCE_KINDS)[number];

export type RuleProvenance = {
  sourceKind: RuleSourceKind;
  sourceId: string;
  retrievedAt: string; // ISO 8601 date (YYYY-MM-DD or full timestamp)
  verifiedBy: string; // human identity (Tenant layer, NEVER hardcoded in committed code)
  notes?: string;
};