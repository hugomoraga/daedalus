# tenants/

Specific organizations Daedalus operates. One **profile** per tenant.

A tenant profile selects which modules the tenant uses, sets tenant-specific parameters, and records tenant-specific context. It is **subordinate** to the Constitution and Core Policy (Decision Hierarchy, Article III) and may never override them. Nothing in a tenant profile may leak upward into the Core (Principle 10).

## Current tenants

| Tenant | Profile | Notes |
|---|---|---|
| **Tenant 0** | [`tenant-0-founder-profile.md`](./tenant-0-founder-profile.md) | The founder's independent professional activity. The first validation case — **not** the definition of the system. |

## Boundary discipline (the anti-"Hugo OS" rule)
If something founder-specific is pushing to live in the Core, Constitution, or a module, it belongs **here** instead. Tenant specifics never climb upward. See [Identity §6](../../docs/identity.md).

## No PII in version control
Profiles are conceptual. Real identifiers, financials, client names, and tax identifiers are **not** committed here. The isolated, tenant-scoped store for actual tenant data is a deferred infrastructure decision.

*Tenant 0 is the only tenant in Phase 0. A second tenant in Phase 5 is the real test of the platform thesis.*
