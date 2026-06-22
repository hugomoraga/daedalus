// Staleness config (Spec 010 §11).
// Per-sourceKind threshold for RuleSetStale emissions. Tenant-overridable
// via env vars (see defaultStalenessConfig in adapters/rule-source/).

import type { RuleSourceKind } from "../../../domain/jurisdiction/rule-provenance.ts";

export type StalenessConfig = {
  thresholds: Record<RuleSourceKind, number>; // months
};

export const DEFAULT_STALENESS_THRESHOLDS_MONTHS: Record<RuleSourceKind, number> = {
  "official-publication": 12,
  "legal-advisor-opinion": 6,
  "tenant-declared": 3,
};

// Compute the age of a rule set in whole months (rounded down). Calendar-
// month approximation, good enough for "is this past the threshold?".
export function ageInMonths(retrievedAt: string, asOf: Date = new Date()): number {
  const retrieved = Date.parse(retrievedAt);
  if (Number.isNaN(retrieved)) return Number.POSITIVE_INFINITY;
  const years = asOf.getUTCFullYear() - new Date(retrieved).getUTCFullYear();
  const months = asOf.getUTCMonth() - new Date(retrieved).getUTCMonth();
  return Math.max(0, years * 12 + months);
}

export function isStale(
  retrievedAt: string,
  sourceKind: RuleSourceKind,
  config: StalenessConfig,
  asOf: Date = new Date(),
): { stale: boolean; ageMonths: number; thresholdMonths: number } {
  const thresholdMonths = config.thresholds[sourceKind];
  const ageMonths = ageInMonths(retrievedAt, asOf);
  return {
    stale: ageMonths > thresholdMonths,
    ageMonths,
    thresholdMonths,
  };
}