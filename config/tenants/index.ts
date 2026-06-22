// Tenant config loader (Tenant layer). Keeps tenant resolution out of the CLI.
// Deliberately a simple registry + loader, not a TenantConfigPort/Adapter — Simplicity First.
// It can be promoted to a port later if a non-file source is ever needed (record in an ADR).

import { tenant0 } from "./tenant-0.ts";
import { tenantOther } from "./tenant-other.ts";
import { tenantDemo } from "./tenant-demo.ts";
import type { TenantConfig } from "./tenant-0.ts";

const registry: Record<string, TenantConfig> = {
  [tenant0.id]: tenant0,
  [tenantOther.id]: tenantOther,
  [tenantDemo.id]: tenantDemo,
};

export const defaultTenantId = tenant0.id;

export function loadTenantConfig(tenantId: string): TenantConfig {
  const config = registry[tenantId];
  if (config === undefined) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }
  return config;
}

export type { TenantConfig };
