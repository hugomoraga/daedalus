// PolicyProvenance (Spec 009 §3.3) — mandatory metadata for every policy.
// Mirrors Spec 008 §3.3 (RuleProvenance) — same intent (who vouched for this
// content, when, with what source), same mandatory nature. Missing
// provenance is a hard error (validated by validatePolicyProvenance in
// application/policy/).

export const POLICY_SOURCE_KINDS = [
  "official-publication",
  "legal-advisor-opinion",
  "tenant-declared",
] as const;

export type PolicySourceKind = (typeof POLICY_SOURCE_KINDS)[number];

export type PolicyProvenance = {
  sourceKind: PolicySourceKind;
  sourceId: string;
  retrievedAt: string; // ISO 8601 date
  verifiedBy: string; // human identity (Tenant layer; PII never in committed code)
  notes?: string;
};