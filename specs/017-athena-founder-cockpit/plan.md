# Plan — Athena (Founder's Working Surface)

**Status:** Draft (planning; build not authorized) · companion to [Spec 017 v0.1.0](./spec.md)
**Goal:** Build Athena as a multi-tenant, read+write+configure driving adapter parallel to `apps/atlas/`. The founder's working surface — where decisions are made, configurations are set, and attention is allocated. Athena is a *client* of the Platform API; it contains no business logic.
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [ADR-005](../../governance/decisions/ADR-005-atlas-driving-adapter.md) (parallels), [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) (consumes the Platform API), [Spec 015](../../specs/015-spec-file-convention/spec.md), [Spec 016](../../specs/016-platform-api/spec.md) (consumed)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> **Build authorization.** Pre-conditions are **not** yet satisfied. Per [Spec 017 §13](../../specs/017-athena-founder-cockpit/spec.md), the build is gated on six conditions: (1) Spec 017 ratification, (2) parallel ADR-011 (or equivalent) accepted, (3) Platform API built and reachable, (4) the use cases Athena needs are exposed via `registerApi`, (5) role-triage logic defined, (6) first tenant configured end-to-end. Until all six clear, the plan below is **forward-planning**, not a build authorization.

> **Task ID convention.** This is a single-package spec (`apps/athena/`); the canonical task prefix is **`T-NN`** (no module namespace). When implementation starts, `tasks.md` follows the [Spec 015](../../specs/015-spec-file-convention/spec.md) format — one checkbox per task, each tagged with a spec AC (`(AC-N)`).

---

## 0. Q resolutions (from Spec 017 §11)

The 10 open questions in spec.md §11 are **forward** to be resolved by the steward before ratification. They live in the spec; this plan does not duplicate them. The natural order of resolution: Q1 (auth), Q2 (SSR), Q3 (role assignment location), Q5 (configuration forms), Q9 (which roles populate in v0) are the heaviest; the rest are v1 concerns.

---

## 1. Architecture

```
apps/athena/                                # NEW driving adapter (composition root only; UI client of the Platform API)
  package.json                              # @daedalus/athena · dependencies: {} (zero deps)
  src/
    server.ts             # Node 22 native http.createServer; SSR shell; bind 0.0.0.0:$PORT
    api-client.ts         # the ONLY file that knows the API's URL shape; thin fetch wrapper
    session.ts            # per-session API key (HttpOnly cookie); 401/403 handling
    views/                # SSR templates (parallels Atlas's templates/)
      layout.ts           # working-surface layout: top nav + left rail + main + footer
      triage.ts           # the opening panel — items grouped by role
      decisions.ts        # the decisions inbox — Approve / Reject / Defer / Delegate
      opportunities.ts    # ranked list (from Spec 003 via the API)
      proposals.ts        # active proposals (from Spec 002)
      compliance.ts       # obligations (from Spec 004)
      workflows.ts        # active processes, queue, metrics (from Spec 011)
      financials.ts       # expected / confirmed / received (from Spec 001)
      catalog.ts          # service catalog (config)
      agents.ts           # agents (Phase 5; absent in v0 per AC-6)
      channels.ts         # channels (Phase 5; absent in v0 per AC-6)
      pipelines.ts        # pipelines (Phase 5; absent in v0 per AC-6)
      activity.ts         # recent business events (filtered)
    panels/
      register.ts         # panel registry: every panel declares its API endpoint + role + backing projection
      role-triage.ts      # the pure role-triage function (renders the opening panel)
    tokens.ts             # re-export from apps/atlas/src/tokens.ts (single source of truth)
    forms/
      catalog.ts          # schema-driven form (or hand-rolled v0)
      agent.ts            # (Phase 5; placeholder)
      channel.ts          # (Phase 5; placeholder)
      pipeline.ts         # (Phase 5; placeholder)
    cli.ts                # thin entry point: `node apps/athena/src/cli.ts serve [--port N]`
  tests/
    athena-reads-via-api.test.ts          # AC-1
    athena-writes-via-api.test.ts         # AC-2
    athena-tenant-isolation.test.ts       # AC-3
    athena-role-triage.test.ts            # AC-4
    athena-decisions-inbox.test.ts        # AC-5
    athena-configuration.test.ts          # AC-6
    athena-idempotency.test.ts            # AC-7
    athena-delegation-stub.test.ts        # AC-8
    athena-no-business-logic.test.ts      # AC-9
    athena-deps.test.ts                   # AC-10
    athena-tokens.test.ts                 # AC-11
    athena-generic.test.ts                # AC-12
```

Dependency rule (per `docs/repository-structure.md`): `apps/athena → apps/api → packages/core` and to modules that the API serves. **Athena does not import from `@daedalus/*` packages directly** (AC-9). The only allowed re-export is `tokens.ts` from Atlas (single source of truth for design tokens, per [ADR-005 §6](../../governance/decisions/ADR-005-atlas-driving-adapter.md) and Spec 015).

Athena is a **client of the Platform API**:
- Every read is `apiClient.get(tenantId, "/v1/...")`.
- Every write is `apiClient.post(tenantId, "/v1/.../commands/<useCase>", { payload, metadata }, { idempotencyKey, causationId, correlationId })`.
- The API enforces auth, multi-tenancy, policy, and idempotency. Athena does not re-implement any of that.

---

## 2. v0 build — Draft (forward-planning, not authorized)

The T-NN task list lands in `tasks.md` when the activation gates in Spec 017 §13 clear. The natural breakdown (forward-planning):

- **Phase A — scaffolding + reads** (gated on the Platform API Phase A green):
  - `apps/athena/` scaffolding + `server.ts` + `session.ts` + `api-client.ts`
  - Atlas token re-export (`tokens.ts`)
  - Layout, top nav, left rail (parallels Atlas but with the Athena panel set)
  - Triage panel (role-grouped items from the API's `projections/triage`)
  - Decisions inbox (read-only first; Approve/Reject buttons appear in Phase B)
  - Read-only panels: opportunities, proposals, compliance, workflows, financials, activity
  - Tests: AC-1, AC-3, AC-4, AC-9, AC-10, AC-11, AC-12

- **Phase B — writes + configuration** (gated on the Platform API Phase B green):
  - Decisions inbox: Approve / Reject / Defer / Delegate actions (one-click dispatch via the API)
  - Configuration panels: catalog, agents (placeholder), channels (placeholder), pipelines (placeholder)
  - Forms (hand-rolled v0; schema-driven v1)
  - Tests: AC-2, AC-5, AC-6, AC-7

- **Phase C — production hardening + delegation** (gated on the founder using Athena daily):
  - Idempotency keys in the UI (stable per logical action, not per click)
  - Empty / absent / unreachable states explicit (per Atlas's AC-6 pattern)
  - Delegation stub (Q8 resolution; "v1" tooltip on the placeholder affordance)
  - Performance: SSR with embedded JSON-LD, per Atlas's pattern
  - Tests: AC-7 (idempotency in the UI), AC-8 (delegation stub), AC-9 hardened

- **Evidence run** (per `docs/evidence/` convention):
  - Boot Athena + the Platform API in a fresh worktree
  - Seed two tenants (overlapping identifiers per AC-3)
  - Walk through every panel for both tenants; snapshot pass/fail
  - Exercise every write action; assert the API received the expected commands
  - Save under `docs/evidence/017-athena-founder-cockpit/`

The phases roll into `tasks.md` as `## N. Phase <X> — <status>` sections with `T-NN` lines once the gates clear.

---

## 3. Open questions for implementation

These are the questions that surface at *implementation* time, distinct from the *spec* open questions in Spec 017 §11 (forward to steward resolution). They live here as a parking lot for the implementer; not blocking on ratification.

- **P1 — Session storage.** Where does the API key live between page loads? *Recommendation:* HttpOnly cookie set by Athena's `session.ts` on first request; cleared on logout. v0 has no real auth UI; the founder pastes the key once.
- **P2 — `api-client.ts` shape.** Is it a class with methods (`get`, `post`) or a function with verbs (`apiCall({ method, path, body, headers })`)? *Recommendation:* class with methods. Reads as `apiClient.get(tenantId, "/events")`; writes as `apiClient.postCommand(tenantId, "proposal/approve", payload)`.
- **P3 — Role-tag emission.** When do projections start carrying role tags? *Recommendation:* as part of the API's Phase A. Projections emit `role`, `urgency`, `nextAction` per item. Athena renders.
- **P4 — "Unclassified" warning UX.** AC-4 says unclassified items render with a warning. *Recommendation:* small inline label ("⚠ unclassified") with a tooltip explaining the omission. Not a blocking modal.
- **P5 — Form library.** v0 ships hand-rolled forms. v1 may use a JSON-Schema-driven generator. *Recommendation:* hand-rolled for v0; JSON-Schema-driven is a v1 add-on.
- **P6 — "Boss" and "Developer" populations.** v0 may not have all four roles populated. *Recommendation:* ship with admin, operator, boss populated (from the available projections); "developer" appears in the role taxonomy with an empty list, signaling "you do not currently wear that hat" (per Q9 resolution).
- **P7 — Cross-tenant view (v1 future).** Today Athena is one-tenant-at-a-time. v1 may add a cross-tenant view (for the founder who runs multiple tenants). *Recommendation:* out of scope for v0; design the panel registry so a cross-tenant view is additive in v1.
- **P8 — The "Phase 5 not yet available" placeholder.** Per Q7 resolution, v0 ships with placeholder panels for agents, channels, pipelines. *Recommendation:* each placeholder is an explicit tile ("Agents — Phase 5 not yet available") that is *absent* in code (per Atlas's AC-6) but renders an explanatory state if the user navigates to its URL. The placeholder is honest, not aspirational.

---

## 4. Definition of done (when build is authorized)

A phase is **done** when:
- The T-NN tasks in `tasks.md` are all `- [x]` for that phase.
- `node --test apps/athena/tests/` is green for the phase's AC tests.
- `tools/scripts/check-spec-conventions.mjs` is clean.
- An evidence run is recorded under `docs/evidence/017-athena-founder-cockpit/`.
- A PR is opened and merged with the canonical commit-message format.
- Theia (when run) shows `12 / 12` (or current count) for spec 017 with the phase marked Shipped.

The **overall spec** is done when all phases ship, AC-12 (generic from day one) is green against two seeded tenants, the Platform API is reachable, the Atlas token linter is green (no token drift introduced by Athena), and the founder uses Athena daily to dispatch decisions and configurations that previously required the CLI.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), and the [Roadmap](../../docs/roadmap.md). Forward-planning companion to [Spec 017 v0.1.0](./spec.md). A read+write+configure driving adapter; a client of the Platform API; nothing more. The first consumer of the Platform API. Built for the founder's working surface; generic from day one; ready for delegation when Phase 5 lands.*
