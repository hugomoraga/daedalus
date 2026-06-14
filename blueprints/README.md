# blueprints/

The **conceptual model** of Daedalus — design artifacts that *describe* the system but are **not code**. Grouped here (per [ADR-003](../governance/decisions/ADR-003-modular-monorepo.md)) so the conceptual layer does not compete visually with implementation (`apps/`, `packages/`) at the repo root.

## What lives here

| Folder | Conceptual content |
|---|---|
| `domains/` | DDD bounded contexts and aggregates (Tenancy & Identity, Commercial, Delivery & Billing) |
| `modules/` | The reusable module catalog (Proposal Generation, Revenue Visibility, …) |
| `tenants/` | Tenant **profiles**, incl. `tenant-0-founder-profile.md` (the founder case; not runtime config) |
| `events/` | Event vocabulary design notes (the narrative catalog is `docs/event-catalog.md`) |
| `policies/`, `workflows/`, `agents/` | Design notes for the future Policy/Workflow/Agent engines |
| `knowledge/` | Organizational knowledge-base design |

Cross-cutting notes (loose files, not folders):

- [`modeling-observation-transformations-vs-capabilities.md`](./modeling-observation-transformations-vs-capabilities.md) — non-binding modeling lens: distinguish *what changes* (transformation) from *the mechanism* (capability), validated by the four-tenant test.

## Conceptual vs. real

- **Conceptual** (here): how we *think* about domains, modules, tenants, events.
- **Real code**: `packages/` (core + modules), `apps/` (adapters).
- **Runtime tenant config**: `config/tenants/` (NOT the conceptual profile here).

> `policies/`, `workflows/`, and `agents/` are placeholders today. When the Workflow (Phase 2), Policy (Phase 3), and Agent (Phase 4) engines are built, those concerns **graduate out** of `blueprints/` into packages or runtime config. Their presence here is temporary scaffolding for the conceptual model.

See [Repository Structure](../docs/repository-structure.md) for the full layout and the three zones (implementation / conceptual / canon).
