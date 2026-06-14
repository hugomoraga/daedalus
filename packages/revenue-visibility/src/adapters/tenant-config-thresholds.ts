// Revenue Visibility — adapter for the AlertThresholdsPort.
// Reads thresholds from config/tenants/ (tenant layer; not Core, not module).
// Tenant 0 supplies concrete values; other tenants can be added without code change.

import { loadTenantConfig } from "../../../../config/tenants/index.ts";
import type { AlertThresholdsPort } from "../application/ports/alert-thresholds.ts";
import type { AlertThresholds } from "../domain/alert.ts";

const DEFAULTS: AlertThresholds = {
  runwayFloorMonths: 3,
  concentrationCeilingRatio: 0.6,
  cashflowPeriodMonths: 3,
};

export class TenantConfigThresholdsAdapter implements AlertThresholdsPort {
  async load(tenantId: string): Promise<AlertThresholds> {
    const tenant = loadTenantConfig(tenantId);
    // Tenant config may supply overrides. If absent, fall back to defaults.
    const overrides = (tenant as unknown as { alertThresholds?: Partial<AlertThresholds> }).alertThresholds;
    return {
      runwayFloorMonths: overrides?.runwayFloorMonths ?? DEFAULTS.runwayFloorMonths,
      concentrationCeilingRatio: overrides?.concentrationCeilingRatio ?? DEFAULTS.concentrationCeilingRatio,
      cashflowPeriodMonths: overrides?.cashflowPeriodMonths ?? DEFAULTS.cashflowPeriodMonths,
    };
  }
}