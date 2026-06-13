# modules/

Reusable capabilities that compose the generic Core into solutions for a **class of pain**.

A module is born from a real tenant's pain (the first five come from [Tenant 0](../tenants/tenant-0-founder-profile.md)) but is **designed for any tenant with that pain** (Constitution, Principle 10 — *Generic Core, Specific Tenants*). A module that only works for one tenant is a defect.

## Initial modules (Phase 0 — named, not yet specified)

| Module | Solves (Tenant 0 pain) | Comes online (per [Roadmap](../docs/roadmap.md)) | Spec |
|---|---|---|---|
| **Revenue Visibility** | basic accounting / solvency | Phase 1 (projection-only) | **[Spec 001 — Draft](../specs/001-revenue-visibility/spec.md)** |
| **Opportunity Discovery** | finding clients | Phase 2 | — |
| **Proposal Generation** | converting interest into offers | Phase 2 | — |
| **Tax & Compliance Guard** | tax & compliance | Phase 3 (policy-shaped; blocked on jurisdiction) | — |
| **Administrative Shield** | the administrative tail | Phase 4 (needs agent runtime) | — |

## What belongs here
- One spec-backed module per folder (each begins as a spec in [`specs/`](../specs/)).
- Tenant-specific parameters are **supplied by the tenant profile**, never hard-coded into the module.

## What does not belong here
- Tenant-specific data or assumptions (those live in [`tenants/`](../tenants/)).
- Behavior that should be true for every organization (that belongs in the Core).

*Empty scaffolding in Phase 0. Modules are named and motivated in the Tenant 0 profile; each is specified before it is built.*
