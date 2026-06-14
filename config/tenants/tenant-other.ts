// A second tenant for isolation tests. Reusable across the suite.
// This is NOT a real tenant — just a synthetic counterpart that lets us verify
// cross-tenant safety. No PII.

import type { TenantConfig } from "./tenant-0.ts";

export const tenantOther: TenantConfig = {
  id: "tenant-other",
  currency: "CLP",
  enabledModules: ["proposal-generation", "revenue-visibility", "opportunity-discovery"],
  templates: {
    standard: { sections: ["Context", "Scope", "Pricing", "Terms"] },
  },
  alertThresholds: {
    runwayFloorMonths: 3,
    concentrationCeilingRatio: 0.6,
    cashflowPeriodMonths: 3,
  },
};