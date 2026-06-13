# ADR-004 — Package export discipline + minimal event lineage

**Status:** Accepted
**Date:** 2026-06-13
**Deciders:** Stewards
**Related:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](./ADR-003-modular-monorepo.md)

---

## Context

The monorepo (ADR-003) created package boundaries, but the packages were not yet *contracts*: barrels used `export *` and exposed domain internals, ports, and adapters from one entry, allowing accidental coupling. Separately, events carried only a `cause: null` placeholder — insufficient to follow derived events between modules once Revenue Visibility starts reacting to Proposal Generation.

This ADR hardens both **before** new modules are added, so the seams are right from the start. No new features.

## Decision

### 1. Export discipline (packages as explicit contracts)
- Each package declares explicit `exports` in `package.json`. The main entry (`.`) exposes only the **public contract**: use cases, command types, and the ports/domain types strictly needed to consume them.
- **Adapters are behind explicit subpaths** (e.g. `@daedalus/proposal-generation/adapters`), never in the main barrel.
- **No deep imports**: with no wildcard subpath, Node blocks reaching internals (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
- Barrels use **curated named exports**, not `export *`.

### 2. Minimal event lineage
`DomainEvent` becomes: `eventId`, `type`, `tenantId`, `occurredAt`, `actor`, `causationId`, `correlationId`, `payload`.
- `correlationId` groups all events in one flow; `causationId` links to the causing event (`null` at origin).
- Helpers: `startLineage(newId)` for a command-initiated flow; `followFrom(event)` to derive lineage for a reaction (the cross-module seam).
- **No event bus, no workflow engine** — only the fields and two helpers.

### 3. Tenant config out of the CLI
- `loadTenantConfig(tenantId)` + `defaultTenantId` in `config/tenants/`. The CLI holds no tenant rules (the old `currencyFor` is gone).
- Kept as a **simple loader**, not a `TenantConfigPort`/adapter — Simplicity First. Promote to a port only if a non-file source is ever needed (record then).

## Migration

Mechanical, no behavior change:
- `DomainEvent.id` → `eventId`; `DomainEvent.cause` (null) → `causationId` (+ new `correlationId`).
- `enrich` / `appendIntents` take a `Lineage`; use cases call `startLineage(deps.newId)`.
- The draft adapter import moved to the `/adapters` subpath (CLI and tests updated).

## Consequences

**Positive**
- Packages can only couple through their public API; internals are unreachable.
- Adapters are opt-in via subpath, so a module's "normal" surface is contracts, not infrastructure.
- The event log is ready for cross-module derived events (Revenue Visibility) to be followed.

**Negative / risks**
- Slightly more ceremony in barrels (curated exports) — accepted; it is the contract.
- `followFrom` is currently unused (it is the documented seam for the next module); justified as the explicitly-requested lineage enabler, not speculative feature work.

## Acceptance (met)

`node --test` 12/12 green; CLI works; v0 behavior unchanged (`expectedValue=6000 CLP`); deep imports blocked (`ERR_PACKAGE_PATH_NOT_EXPORTED`); adapter resolves only via `/adapters`; CLI contains no tenant logic. No API/UI/DB/agents/workflow/policy engine introduced.
