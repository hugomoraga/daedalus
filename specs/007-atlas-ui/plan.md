# Plan — ATLAS (read-only mission-control driving adapter)

**Status:** Ratified companion to [Spec 007 v1.0](./spec.md) · v0 + v1 shipped
**Goal:** Build ATLAS as a read-only mission-control driving adapter over Core + active modules' projections. SSR with embedded JSON-LD, zero external runtime dependencies.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), Spec 001–006 contracts.
**Version:** 1.0.0
**Last updated:** 2026-06-22

> **Build authorization.** Pre-conditions are satisfied: (a) Spec 007 is ratified (v1.0, 2026-06-22), (b) ADR-005 added ATLAS as a read-only driving adapter, (c) stewards approved. v0 shipped in PR #18 (scaffolding + tokens + layout + SSR server + tenant resolver + Welcome + Events + Activity + Logs + System Health + AC test suite). v1 shipped in PR #19 (Throughput + Monitoring panels backed by Revenue Visibility v1 projections). Phase 2 / Phase 5 phases below remain blocked on their respective engines.

---

## 0. Q resolutions (from Spec 007 §12)

- **Q1 (SSR shape):** SSR with embedded JSON-LD. The browser never receives raw JSONL.
- **Q2 (multi-tenant per session):** One tenant per session, explicit switch.
- **Q3 (sections without backing models):** Hidden, not placeholders (AC-6).
- **Q4 (PDF export):** Deferred.
- **Q5 (Welcome composition):** tenant name + total events + last event timestamp + counts of active proposals / projects / invoices + friction-test status.

---

## 1. Architecture

```
apps/atlas/                              # NEW driving adapter (composition root only)
  src/
    server.ts            # Node 22 native http server; tenant resolver; routing
    tenant.ts            # resolves tenantId from URL/header; rejects unknown
    projections.ts       # thin facade: calls existing @daedalus/core projectXxx
    tokens.ts            # design tokens (color, type, space) — only source of truth
    panels/
      welcome.ts         # Welcome panel (AC-5, AC-7)
      events.ts          # Events stream (raw, paginated, lineage-rendered)
      activity.ts        # Activity Timeline (events sorted by occurredAt, grouped)
      logs.ts            # Recent Logs (events, different default filter)
      throughput.ts      # Throughput (windowed projection) — v1
      monitoring.ts      # Monitoring (alerts) — v1
      health.ts          # System Health (replay integrity, hash, count)
      register.ts        # panel registry: every panel declares its backing model
    templates/
      paper.ts           # HTML primitives (Card, Label, Metric, Rule, Tag)
      layout.ts          # mission-control layout: top nav + left rail + main + footer
      svg.ts             # hand-authored SVG line primitives (orbital, chain)
    cli.ts               # thin entry point: `node apps/atlas/src/cli.ts serve`
  assets/
    fonts/
      Inter-Tight-*.woff2
      Inter-*.woff2
      JetBrainsMono-*.woff2
    favicon.svg
  tests/
    atlas-readonly.test.ts          # AC-1
    atlas-tenant-isolation.test.ts  # AC-2
    atlas-replay-integrity.test.ts  # AC-3
    atlas-token-linter.test.ts      # AC-5
    atlas-panel-manifest.test.ts    # AC-6
    atlas-tenant-switch.test.ts     # AC-8
    atlas-welcome.test.ts           # AC-7
  package.json                       # no `dependencies` (zero external runtime deps)
  README.md                          # how to run; what each panel reads
```

ATLAS imports from packages via package entry points only (no deep imports, per ADR-004):

```ts
import { projectProposal, projectProject, projectInvoice } from "@daedalus/core";
import { financialSummary, alerts } from "@daedalus/revenue-visibility";
import { qualifiedLeadSummary } from "@daedalus/opportunity-discovery";
```

It never writes to the event store. It never imports from another driving adapter.

---

## 2. CLI command (v0 — for atlas itself, not Daedalus)

ATLAS is itself a CLI-driven app. Its own entry point:

| Command | Effect |
|---|---|
| `node apps/atlas/src/cli.ts serve --port 8788 --tenant tenant-0` | Start the SSR server bound to one tenant |
| `node apps/atlas/src/cli.ts check --tenant tenant-0` | Run the token linter + panel manifest test in isolation |

> **No commands are added to Daedalus's own CLI.** `apps/cli/` and `apps/atlas/` are siblings. ATLAS is a separate composition root.

---

## 3. Read-models consumed

All consumed read-models already exist:

| Source | Read-model | Used by panel |
|---|---|---|
| `@daedalus/core` | `projectProposal(events)` | Welcome (counts), Events, Activity |
| `@daedalus/core` | `projectProject(events)` | Welcome, Events |
| `@daedalus/core` | `projectInvoice(events)` | Welcome, Events |
| `@daedalus/core` | event stream (raw, filtered) | Events, Activity, Logs |
| `@daedalus/core` | replay integrity check | System Health |
| `@daedalus/revenue-visibility` | `FinancialSummary` | Welcome (totals), Monitoring (v1) |
| `@daedalus/revenue-visibility` | alerts | Monitoring (v1) |
| `@daedalus/opportunity-discovery` | qualified leads summary | Welcome (counts) |

If a module is not active for a tenant, its panels are **not registered** (AC-6).

---

## 4. Build phases

### v0 (Phase 1) — ✅ SHIPPED (PR #18, commit `ca25b73`)
1. `apps/atlas/` scaffolding (workspace-only `dependencies`).
2. SSR server + tenant resolver.
3. Tokens + linter test.
4. Mission-control layout template.
5. **Live panels:** Welcome, Events, Activity, Logs, System Health.
6. Tests AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-8.

**Exit criterion:** ✅ Met. A founder can run `node apps/atlas/src/cli.ts serve`, open `localhost:8788`, switch between two seeded tenants, see their full event stream with lineage, see system health with replay integrity, and never be able to mutate state through the UI.

### v1 (Phase 1+) — ✅ SHIPPED (PR #19, commit `434a404`)
7. **Live panels:** Throughput, Monitoring (alerts).
8. Performance optimization for larger event logs (precomputed projections on disk).

**Exit criterion:** ✅ Met. FinancialSummary + alerts visible per tenant; performance targets hold for 10k events (AC-7).

### Phase 2 — ⛔ BLOCKED (workflow engine shipped; projections not yet projected for ATLAS)
9. **Activate panels:** Active Processes, Queue Status, Workflow Execution Metrics (when their backing models exist).

**Exit criterion:** Workflow panels render data from the workflow engine's projections. Blocked on the workflow engine emitting the projections ATLAS needs (a Spec 008 follow-on; not yet spec'd).

### Phase 5 — ⛔ BLOCKED (agent runtime + second tenant + auth)
10. **Activate panel:** Integrations.
11. Multi-tenant view.
12. Real auth.
13. Real-time SSE updates (deferred from v0).

---

## 5. Acceptance criteria → test mapping

| Spec 007 AC | Test |
|---|---|
| AC-1 (read-only) | `tests/atlas-readonly.test.ts` |
| AC-2 (tenant isolation) | `tests/atlas-tenant-isolation.test.ts` |
| AC-3 (replay integrity) | `tests/atlas-replay-integrity.test.ts` |
| AC-4 (zero external deps) | package.json audit + network capture test |
| AC-5 (token discipline) | `tests/atlas-token-linter.test.ts` |
| AC-6 (panel viability) | `tests/atlas-panel-manifest.test.ts` |
| AC-7 (performance) | `tests/atlas-welcome.test.ts` |
| AC-8 (tenant switch) | `tests/atlas-tenant-switch.test.ts` |

---

## 6. Evidence run (end-to-end, v0)

```
# Setup two seeded tenants via existing CLI
node apps/cli/src/index.ts lead:create        tenant-0 "ACME"
node apps/cli/src/index.ts lead:qualify       tenant-0 <id>
node apps/cli/src/index.ts proposal:finalize  tenant-0 <draftId>
# ... walk the chain through events:submit, approve, project:create, deliver,
# invoice:issue, send, payment:record, invoice:pay, project:close

# Repeat for tenant-other with different data

# Start ATLAS
node apps/atlas/src/cli.ts serve --port 8788

# In a browser, verify:
# - localhost:8788/t/tenant-0   -> renders ACME data only
# - localhost:8788/t/tenant-other -> renders other data only
# - Any POST/PUT/DELETE -> 405 with cliCommand surfaced
# - System Health shows matching SHA-256 hashes on re-replay
# - Switching tenant clears state (AC-8)
```

---

## 7. Definition of done

### v0 + v1 — ✅ MET
- All 7 panels (Welcome, Events, Activity, Logs, Health, Throughput, Monitoring) shipped only when their backing models existed.
- AC-1 through AC-8 covered by `node --test` (see `apps/atlas/tests/`).
- `package.json` of `apps/atlas` declares only `@daedalus/*` workspace packages (zero external runtime deps).
- Token linter fails CI on any raw color / font / spacing literal outside `tokens.ts`.
- Two-tenant seed scenario produced zero cross-tenant rendering.
- `.data/` gitignored; ATLAS reads only tenant-scoped JSONL.

### Phase 2 + Phase 5 — ⛔ BLOCKED
- Active Processes / Queue Status / Workflow Metrics panels ship when Spec 008 follow-on projections exist.
- Integrations panel, multi-tenant view, real auth, and SSE updates ship in Phase 5 (their own specs).

---

## 8. Out of scope (binding — from Spec 007 §9 and §13)

- No writes through ATLAS.
- No auth in v0/v1.
- No SSE / WebSocket in v0/v1.
- No charts library.
- No glassmorphism, gradients, neon, 3D, animation ornament.
- No new Core events, aggregates, projections, or ports.
- No mobile-first; desktop mission-control only (tablet minimum).
- No i18n; English only.

---

*Subordinate to [Spec 007](./spec.md), the [Constitution](../../memory/constitution.md), and the [Technical Principles](../../memory/technical-principles.md). Planning only — not a build authorization.*