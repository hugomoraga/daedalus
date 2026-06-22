// Tenant-demo configuration (Tenant layer — NOT Core, NOT Module).
// Dev fixture for Spec 013 (Atlas Demo Seeder). Not a real tenant — no PII, no
// env-driven secrets, no real money amounts. Lives only to give Atlas panels
// realistic content during development. See specs/013-atlas-demo-seeder/spec.md.

import type { TenantConfig } from "./tenant-0.ts";

export const tenantDemo: TenantConfig = {
  id: "tenant-demo",
  currency: "CLP",
  // All currently-active modules enabled so every Atlas panel can render.
  enabledModules: [
    "proposal-generation",
    "revenue-visibility",
    "opportunity-discovery",
  ],
  templates: {
    standard: { sections: ["Context", "Scope", "Pricing", "Terms"] },
  },
  // Sensible defaults — these thresholds only matter for the seeded scenario,
  // which deliberately triggers `revenue_concentration` once.
  alertThresholds: {
    runwayFloorMonths: 3,
    concentrationCeilingRatio: 0.6,
    cashflowPeriodMonths: 3,
  },
};
