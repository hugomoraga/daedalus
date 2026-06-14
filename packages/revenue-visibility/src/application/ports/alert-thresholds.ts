// Revenue Visibility — port for tenant-injected alert thresholds.
// Per Spec 001 §9, rule logic is generic (Module); thresholds are Tenant.
// A port keeps the use cases pure and the threshold source swappable
// (config now, future: policy engine).

import type { AlertThresholds } from "../../domain/alert.ts";

export interface AlertThresholdsPort {
  load(tenantId: string): Promise<AlertThresholds>;
}