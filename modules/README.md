# modules/

Reusable capabilities that compose the generic Core into solutions for a **class of pain**.

A module is born from a real tenant's pain (the first five come from [Tenant 0](../tenants/tenant-0-founder-profile.md)) but is **designed for any tenant with that pain** (Constitution, Principle 10 — *Generic Core, Specific Tenants*). A module that only works for one tenant is a defect.

## Initial modules — by validation priority (see [Roadmap → Module Validation Sequence](../docs/roadmap.md))

Ordered by **founder value to Tenant 0**, not architectural completeness. Priority is independent of the phase that makes a module's full capability available.

| # | Module | Solves (Tenant 0 pain) | Earliest buildable | Spec |
|---|---|---|---|---|
| 1 | **Proposal Generation** | customer acquisition (closing) | Phase 1 (v0: structured assembly) | **[Spec 002 — Draft](../specs/002-proposal-generation/spec.md)** |
| 2 | **Revenue Visibility** | basic accounting / solvency | Phase 1 (projection-only) | **[Spec 001 — Draft](../specs/001-revenue-visibility/spec.md)** |
| 3 | **Opportunity Discovery** | customer acquisition (top of funnel) | Phase 2 | — |
| 4 | **Tax & Compliance Guard** | tax & compliance | Phase 3 (policy-shaped; blocked on jurisdiction) | — |
| 5 | **Administrative Shield** | the administrative tail | Phase 4 (needs agent runtime) | — |

## What belongs here
- One spec-backed module per folder (each begins as a spec in [`specs/`](../specs/)).
- Tenant-specific parameters are **supplied by the tenant profile**, never hard-coded into the module.

## What does not belong here
- Tenant-specific data or assumptions (those live in [`tenants/`](../tenants/)).
- Behavior that should be true for every organization (that belongs in the Core).

*Empty scaffolding in Phase 0. Modules are named and motivated in the Tenant 0 profile; each is specified before it is built.*
