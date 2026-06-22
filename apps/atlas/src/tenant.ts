// Tenant resolver.
// AC-2: fails closed — unknown tenants return null; no cross-tenant data ever leaks.
// AC-8: switching tenant invalidates client state; the resolver returns a fresh
// context per request and never caches cross-tenant data server-side.

import { defaultTenantId, loadTenantConfig } from "../../../config/tenants/index.ts";
import { tenant0 } from "../../../config/tenants/tenant-0.ts";
import { tenantOther } from "../../../config/tenants/tenant-other.ts";
import { tenantDemo } from "../../../config/tenants/tenant-demo.ts";

export type TenantContext = {
  readonly tenantId: string;
  readonly currency: string;
  readonly activeModules: ReadonlySet<string>;
};

const KNOWN_TENANT_IDS: readonly string[] = Object.freeze([tenant0.id, tenantOther.id, tenantDemo.id]);

export function listKnownTenants(): readonly string[] {
  return KNOWN_TENANT_IDS;
}

export function resolveTenant(tenantId: string | null | undefined): TenantContext | null {
  if (typeof tenantId !== "string" || tenantId.length === 0) return null;
  if (!KNOWN_TENANT_IDS.includes(tenantId)) return null;
  try {
    const cfg = loadTenantConfig(tenantId);
    return {
      tenantId,
      currency: cfg.currency,
      activeModules: new Set(cfg.enabledModules ?? []),
    };
  } catch {
    return null;
  }
}