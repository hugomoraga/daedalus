// Tenant 0 configuration (Tenant layer — NOT Core, NOT Module).
// Parametrizable values are read from process.env with sensible defaults
// (Spec 008 Plan §4.1). See .env.example for the schema.
//
// Real values live in .env (gitignored); .env.example is committed.
// Structural fields (id, templates) stay hardcoded — they are config shape,
// not tenant-specific data.

export type TenantConfig = {
  id: string;
  currency: string;
  enabledModules: string[];
  templates: Record<string, { sections: string[] }>;
  alertThresholds?: {
    runwayFloorMonths: number;
    concentrationCeilingRatio: number;
    cashflowPeriodMonths: number;
  };
};

const env = (key: string, fallback?: string): string | undefined =>
  process.env[key] ?? fallback;

const envCsv = (key: string, fallback: string[]): string[] => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim().length === 0) return fallback;
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
};

const envNumber = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const tenant0: TenantConfig = {
  id: "tenant-0",
  // Confirmed initial currency for Tenant 0 (resolves Spec 002 Q2 / Spec 001 Q4).
  currency: env("TENANT_0_CURRENCY", "CLP") ?? "CLP",
  enabledModules: envCsv("TENANT_0_ENABLED_MODULES", [
    "proposal-generation",
    "revenue-visibility",
    "opportunity-discovery",
  ]),
  templates: {
    standard: { sections: ["Context", "Scope", "Pricing", "Terms"] },
  },
  // Tenant-supplied thresholds (Spec 001 §9: thresholds are Tenant-injected).
  alertThresholds: {
    runwayFloorMonths: envNumber("TENANT_0_RUNWAY_FLOOR_MONTHS", 3),
    concentrationCeilingRatio: envNumber("TENANT_0_CONCENTRATION_CEILING_RATIO", 0.6),
    cashflowPeriodMonths: envNumber("TENANT_0_CASHFLOW_PERIOD_MONTHS", 3),
  },
};

// Future jurisdiction profile (Spec 008) — created by the founder when
// Tenant 0 declares its jurisdiction. Per Plan 008 §4.1, the file MUST
// read values from process.env (no hardcoded PII). The file is the
// founder's task; this JSDoc note is the only reference here until then.
export const jurisdictionFileHint =
  "config/tenants/tenant-0.jurisdiction.ts (founder's task; follows Plan 008 §4.1 env-var pattern)";