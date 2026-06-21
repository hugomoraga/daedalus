# Tasks — ATLAS (mission control driving adapter)

**Status:** Planning (build **not authorized**). Activates only when [Spec 007](./spec.md) is ratified AND an ADR moves ATLAS into the [Roadmap](../../docs/roadmap.md).
**Derives from:** Spec 007 + Plan 007
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-20

> The `/tasks` step for ATLAS. Tasks map 1:1 to Spec 007 acceptance criteria and Plan 007 build steps. v0 is forward-planning; activation is gated on ratification.

---

## 1. Reality check (verified, not assumed)

- **v0 status: planning.** No code yet. The `apps/atlas/` directory does not exist. No `package.json` is declared. The spec has been drafted; ratification + ADR are pre-conditions.
- **Backing read-models:** all consumed by ATLAS already exist (`@daedalus/core` projections from Spec 006; `@daedalus/revenue-visibility` from Spec 001 v0+v1; `@daedalus/opportunity-discovery` from Spec 003).
- **Blockers:** Spec 007 ratification + ADR adding ATLAS to the [Roadmap](../../docs/roadmap.md).

---

## 2. v0 build (Phase 1) — NOT STARTED

Each task maps to a Spec 007 AC and a Plan 007 build step.

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-01 | `apps/atlas/` scaffolding: directory layout, `package.json` with **no** `dependencies`, `assets/` for fonts, `README.md` | AC-4 | ⏸ |
| T-02 | `tokens.ts` — color / type / spacing tokens as the only source of truth; export typed constants | AC-5 | ⏸ |
| T-03 | `templates/layout.ts` — mission-control layout (top nav + left rail + main + footer); `templates/paper.ts` — HTML primitives (Card, Label, Metric, Rule, Tag) | AC-4 | ⏸ |
| T-04 | `server.ts` — Node 22 native http server, routing, SSR with embedded JSON-LD | AC-1, AC-4 | ⏸ |
| T-05 | `tenant.ts` — tenant resolver from URL path `/t/<tenantId>` or header; reject unknown with empty-state (never another tenant's data) | AC-2, AC-8 | ⏸ |
| T-06 | `panels/welcome.ts` — tenant name + total events + last event timestamp + counts of active proposals/projects/invoices + friction-test status | AC-7, AC-6 | ⏸ |
| T-07 | `panels/events.ts` — raw event stream, paginated, lineage-rendered (`correlationId`, `causationId`, `actor`, `occurredAt`, `payload`) | AC-1 | ⏸ |
| T-08 | `panels/activity.ts` — events sorted by `occurredAt`, grouped by day | AC-1 | ⏸ |
| T-09 | `panels/logs.ts` — events with a different default filter (last N, no aggregation) | AC-1 | ⏸ |
| T-10 | `panels/health.ts` — System Health panel: principal projection re-run + SHA-256 of result; alert on divergence | AC-3 | ⏸ |
| T-11 | `panels/register.ts` — panel registry; each panel declares its backing model; absent if not registered (AC-6) | AC-6 | ⏸ |
| T-12 | `cli.ts` — `node apps/atlas/src/cli.ts serve --port 8788 --tenant <id>` + `check` subcommand | — | ⏸ |
| T-13 | Tests AC-1..AC-8 + the dedicated tenant-isolation test against two seeded tenants | AC-1..AC-8 | ⏸ |
| T-14 | Static font assets in `apps/atlas/assets/fonts/`; `@font-face` declarations in templates; no CDN | AC-4 | ⏸ |
| T-15 | Token-linter test (CI-blocking): fails on raw color / font / spacing literals outside `tokens.ts` | AC-5 | ⏸ |
| T-16 | Evidence run: two seeded tenants; no cross-tenant rendering; 405 on writes; replay hashes match | AC-1, AC-2, AC-3, AC-7 | ⏸ |

---

## 3. v1 build (Phase 1+) — NOT STARTED

Activates when v0 ships and Revenue Visibility v1 projections are stable.

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-17 | `panels/throughput.ts` — windowed projection over events (per-tenant time window) | AC-7 | ⏸ |
| T-18 | `panels/monitoring.ts` — alerts panel (reads Revenue Visibility alerts) | — | ⏸ |
| T-19 | Performance hardening: precomputed projections on disk for tenants with > 10k events | AC-7 | ⏸ |

---

## 4. Phase 2 — BLOCKED (workflow engine)

| ID | Task | Blocked by | Status |
|---|---|---|---|
| T-20 | `panels/active-processes.ts` — Workflow engine backing model | Phase 2 not started | ⛔ |
| T-21 | `panels/queue-status.ts` — Event bus backing model | Phase 2 not started | ⛔ |
| T-22 | `panels/workflow-metrics.ts` — Workflow execution metrics | Phase 2 not started | ⛔ |

---

## 5. Phase 5 — BLOCKED (agent runtime + second tenant + auth)

| ID | Task | Blocked by | Status |
|---|---|---|---|
| T-23 | `panels/integrations.ts` — Integrations registry backing model | Phase 5 not started | ⛔ |
| T-24 | Multi-tenant view (multi-pane) | Phase 5 not started | ⛔ |
| T-25 | Real authentication | Phase 5 not started | ⛔ |
| T-26 | Real-time SSE updates | Phase 5 not started | ⛔ |

---

## 6. Out of scope (binding — from Spec 007 §9, §13)

- No write paths.
- No auth in v0/v1.
- No real-time push in v0/v1.
- No charts library.
- No glassmorphism, gradients, neon, 3D, animation ornament.
- No new Core events, aggregates, projections, or ports.
- No mobile-first; desktop mission-control only (tablet minimum).
- No i18n; English only.

---

## 7. Module impact (forward-compatibility note)

- **Core**: zero changes. ATLAS consumes existing projections and the event stream.
- **Revenue Visibility**: zero changes. ATLAS consumes `FinancialSummary` and alerts via the module's existing public contract.
- **Opportunity Discovery**: zero changes. ATLAS consumes qualified leads summary.
- **Tax & Compliance Guard / Administrative Shield**: still blocked on Phase 3 / Phase 4. ATLAS has no panel for them today; will gain a panel only when their backing projections exist.

---

## 8. Activation criteria

T-01 through T-16 may begin only when **all** of the following are true:

1. **Spec 007 is ratified** by stewards.
2. **An ADR moves ATLAS into the [Roadmap](../../docs/roadmap.md)** at the appropriate phase.
3. The founder (Tenant 0) confirms the v0 panel list (Welcome, Events, Activity, Logs, Health) matches their operator needs.

---

*Subordinate to [Spec 007](./spec.md) and [Plan 007](./plan.md). Planning only — not a build authorization.*