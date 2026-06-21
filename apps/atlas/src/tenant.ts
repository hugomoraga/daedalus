// Tenant resolver.
// AC-2: fails closed — unknown tenants return null; no cross-tenant data ever leaks.
// AC-8: switching tenant invalidates client state; the resolver returns a fresh
// context per request and never caches cross-tenant data server-side.

import { defaultTenantId, loadTenantConfig } from "../../../config/tenants/index.ts";

export type TenantContext = {
  readonly tenantId: string;
  readonly currency: string;
  readonly activeModules: ReadonlySet<string>;
};

const KNOWN_TENANTS_CACHE: ReadonlySet<string> | null = null;

export function listKnownTenants(): readonly string[] {
  if (KNOWN_TENANTS_CACHE !== null) return Array.from(KNOWN_TENANTS_CACHE);
  return [defaultTenantId];
}

export function resolveTenant(tenantId: string | null | undefined): TenantContext | null {
  if (typeof tenantId !== "string" || tenantId.length === 0) return null;
  const known = listKnownTenants();
  if (!known.includes(tenantId)) return null;
  const cfg = loadTenantConfig(tenantId);
  return {
    tenantId,
    currency: cfg.currency,
    activeModules: new Set(cfg.enabledModules ?? []),
  };
}