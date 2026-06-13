// Tenant 0 configuration (Tenant layer — NOT Core, NOT Module).
// Selects modules and supplies tenant parameters. NO PII (Tenant 0 Profile rule).

export type TenantConfig = {
  id: string;
  currency: string;
  enabledModules: string[];
  templates: Record<string, { sections: string[] }>;
};

export const tenant0: TenantConfig = {
  id: "tenant-0",
  // Placeholder — founder to confirm (Spec 002 Q2 / Spec 001 Q4). Drives expectedValue currency.
  currency: "CLP",
  enabledModules: ["proposal-generation"],
  templates: {
    standard: { sections: ["Context", "Scope", "Pricing", "Terms"] },
  },
};
