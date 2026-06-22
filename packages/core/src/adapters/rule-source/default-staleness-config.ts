// Default staleness config (Spec 010 §11 + Plan §4, task R-10).
// Env-var-driven defaults. Without .env, falls back to the spec's
// baseline thresholds (12/6/3 months per sourceKind). PII-safe
// (no PII in env keys; only the threshold numbers).

import {
  DEFAULT_STALENESS_THRESHOLDS_MONTHS,
  type StalenessConfig,
} from "../../domain/rule-source/staleness.ts";

function envMonths(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function defaultStalenessConfig(): StalenessConfig {
  return {
    thresholds: {
      "official-publication": envMonths(
        "TENANT_0_STALENESS_OFFICIAL_PUBLICATION_MONTHS",
        DEFAULT_STALENESS_THRESHOLDS_MONTHS["official-publication"],
      ),
      "legal-advisor-opinion": envMonths(
        "TENANT_0_STALENESS_LEGAL_ADVISOR_OPINION_MONTHS",
        DEFAULT_STALENESS_THRESHOLDS_MONTHS["legal-advisor-opinion"],
      ),
      "tenant-declared": envMonths(
        "TENANT_0_STALENESS_TENANT_DECLARED_MONTHS",
        DEFAULT_STALENESS_THRESHOLDS_MONTHS["tenant-declared"],
      ),
    },
  };
}