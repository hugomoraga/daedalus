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
  // Confirmed initial currency for Tenant 0 (resolves Spec 002 Q2 / Spec 001 Q4).
  currency: "CLP",
  enabledModules: ["proposal-generation", "revenue-visibility", "opportunity-discovery"],
  templates: {
    standard: { sections: ["Context", "Scope", "Pricing", "Terms"] },
  },
};
