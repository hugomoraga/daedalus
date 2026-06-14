// Tenant 0 configuration (Tenant layer — NOT Core, NOT Module).
// Selects modules and supplies tenant parameters. NO PII (Tenant 0 Profile rule).

export type TenantConfig = {
  id: string;
  currency: string;
  enabledModules: string[];
  templates: Record<string, { sections: string[] }>;
  // Optional alert thresholds for Revenue Visibility. If absent, the module's
  // TenantConfigThresholdsAdapter falls back to its built-in defaults.
  alertThresholds?: {
    runwayFloorMonths: number;
    concentrationCeilingRatio: number;
    cashflowPeriodMonths: number;
  };
};

export const tenant0: TenantConfig = {
  id: "tenant-0",
  // Confirmed initial currency for Tenant 0 (resolves Spec 002 Q2 / Spec 001 Q4).
  currency: "CLP",
  enabledModules: ["proposal-generation", "revenue-visibility", "opportunity-discovery"],
  templates: {
    standard: { sections: ["Context", "Scope", "Pricing", "Terms"] },
  },
  // Tenant-supplied thresholds (Spec 001 §9: thresholds are Tenant-injected).
  alertThresholds: {
    runwayFloorMonths: 3,         // flag if runway < 3 months
    concentrationCeilingRatio: 0.6, // flag if any single source > 60% of confirmed+received
    cashflowPeriodMonths: 3,      // trailing period for the negative_cashflow check
  },
};
