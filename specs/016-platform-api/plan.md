# Plan — Platform API

**Status:** Draft (planning; build not authorized) · companion to [Spec 016 v0.2.0](./spec.md)
**Goal:** Build the Platform API as a programmatic driving adapter parallel to `apps/cli/` and `apps/atlas/`. Same use cases as the CLI, exposed over HTTP. Multi-tenant by construction, authenticated, governed by policy. Zero external runtime dependencies. Designed for 12-factor / Cloud Run.
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [ADR-005](../../governance/decisions/ADR-005-atlas-driving-adapter.md) (parallels), [Spec 009](../../specs/009-policy-engine/spec.md), [Spec 011](../../specs/011-workflow-engine-projections/spec.md)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> **Build authorization.** Pre-conditions are **not** yet satisfied. Per [Spec 016 §13](../../specs/016-platform-api/spec.md), the build is gated on: (1) Spec 016 ratification, (2) parallel ADR-010 (or equivalent) accepted, (3) Policy Engine (Spec 009) wired to evaluate HTTP requests, (4) CLI use case registry enumerated, (5) `registerApi` hook signature locked, (6) first consumer named. Until all six clear, the plan below is **forward-planning**, not a build authorization. The plan expands into task-grade detail when the gates clear.

> **Task ID convention.** This is a single-package spec (`apps/api/`); the canonical task prefix is **`T-NN`** (no module namespace). When implementation starts, `tasks.md` follows the [Spec 015](../../specs/015-spec-file-convention/spec.md) format — one checkbox per task, each tagged with a spec AC (`(AC-N)`).

---

## 0. Q resolutions (from Spec 016 §11)

All 12 open questions resolved by the steward on 2026-06-22 (see spec.md Revision note v0.2.0):

- **Q1 (auth):** API keys per-tenant via `Authorization: Bearer <key>`. v0.
- **Q2 (idempotency):** in-process, 24h TTL, per-instance (caveat in AC-9).
- **Q3 (URL slug):** `:` → `/`, lowercase.
- **Q4 (OpenAPI):** hand-written, validated against §4 in CI (AC-7).
- **Q5 (`registerApi`):** `(router, ctx) → void` hook.
- **Q6 (raw event emission):** not exposed in v0; reserved.
- **Q7 (CORS):** none in v0.
- **Q8 (lineage headers):** generate fresh if absent.
- **Q9 (versioning):** URL path `/v1/...`.
- **Q10 (key provisioning):** env config — `DAEDALUS_API_KEYS_FILE` or per-tenant env var.
- **Q11 (rate limit):** 100 req/s default, env-configurable.
- **Q12 (shutdown):** 30s default, env-configurable.

---

## 1. Architecture

```
apps/api/                                # NEW driving adapter (composition root only)
  package.json                           # @daedalus/api · dependencies: {} (zero deps)
  src/
    server.ts            # Node 22 native http.createServer; bind 0.0.0.0:$PORT; SIGTERM graceful
    router.ts            # top-level router; mounts /healthz, /readyz, /openapi.json, /v1/*
    routes/
      health.ts          # GET /healthz, GET /readyz (AC-6)
      openapi.ts         # GET /openapi.json (AC-7) — hand-written, validated in CI
      events.ts          # GET /v1/tenants/:tenantId/events, /events/:eventId
      projections.ts     # GET /v1/tenants/:tenantId/projections/:name
      obligations.ts     # GET /v1/tenants/:tenantId/obligations (wraps @daedalus/tax-compliance-guard)
      workflows.ts       # GET /v1/tenants/:tenantId/workflows/instances, /:id
      commands.ts        # POST /v1/tenants/:tenantId/commands/:useCase (write path; gated on Spec 009)
    auth.ts              # API key resolution (env file or per-tenant env var); 401/403 logic
    idempotency.ts       # in-process cache; 24h TTL; per-(tenantId, useCase, key)
    policy.ts            # wraps evaluateAndRecordPolicy; emits PolicyDecisionRecorded; AC-13 gate
    errors.ts            # canonical error envelope { error, message, requestId }; status code map
    ratelimit.ts         # in-process token bucket per tenant; 100 req/s default
    register.ts          # enumerates @daedalus/* workspace packages; calls registerApi(router, ctx)
    lineage.ts           # X-Causation-Id / X-Correlation-Id propagation; generates fresh if absent
    ctx.ts               # ctx type used by registerApi: { eventStore, policyEngine, tenantResolver,
                          #                              idempotencyStore, useCaseRegistry }
    openapi.json         # hand-written OpenAPI 3.1 document (mirror of spec.md §4)
    cli.ts               # thin entry point: `node apps/api/src/cli.ts serve [--port N]`
  tests/
    api-health.test.ts            # AC-6
    api-openapi.test.ts           # AC-7
    api-deps.test.ts              # AC-8
    api-auth.test.ts              # AC-2
    api-tenant-isolation.test.ts  # AC-3
    api-policy-gating.test.ts     # AC-13
    api-cli-parity.test.ts        # AC-1
    api-idempotency.test.ts       # AC-5
    api-lineage.test.ts           # AC-10
    api-shutdown.test.ts          # AC-11
    api-registry-parity.test.ts   # AC-12
```

Dependency rule (per `docs/repository-structure.md`): `apps/api → packages/core` and to modules that export `registerApi`. The API depends on `@daedalus/core` for `EventStorePort`, `useCaseRegistry`, `evaluateAndRecordPolicy`, the `DomainEvent` type, and the projection surface. It does **not** import adapter internals.

The API enumerates modules at boot: every workspace package that exports a `registerApi(router, ctx)` function is mounted under `/v1/tenants/:tenantId/...`. Modules that omit the hook (e.g. early-stage modules, modules whose use cases are CLI-only by design) are not exposed over HTTP — `api-registry-parity.test.ts` asserts the parity between CLI's `case "..."` set and the API's mounted routes.

---

## 2. v0 build — Draft (forward-planning, not authorized)

The T-NN task list lands in `tasks.md` when the activation gates in Spec 016 §13 clear. The natural breakdown (forward-planning) is:

- **Phase A — read paths only** (gated on Spec 016 ratified + ADR-010 accepted; no Policy Engine dependency for reads):
  - `apps/api/` scaffolding + `server.ts` + `router.ts` (Node 22 native HTTP, zero deps)
  - `/healthz`, `/readyz`, `/openapi.json`
  - Auth middleware (env file + per-tenant env var)
  - Tenant resolver + isolation middleware
  - `GET /v1/tenants/:tenantId/events` (read)
  - `GET /v1/tenants/:tenantId/projections/:name`
  - `GET /v1/tenants/:tenantId/obligations` (after Spec 004 module opts in)
  - `GET /v1/tenants/:tenantId/workflows/instances`, `/:id` (after Spec 011 module opts in)
  - Tests: AC-1, AC-2, AC-3, AC-6, AC-7, AC-8, AC-12 (parity)

- **Phase B — write paths** (gated on Spec 009 ready to evaluate HTTP requests):
  - `routes/commands.ts` — `POST /v1/tenants/:tenantId/commands/:useCase`
  - `policy.ts` — `evaluateAndRecordPolicy` wrapper; lineage propagation
  - `idempotency.ts` — TTL-based eviction
  - Tests: AC-4, AC-5, AC-9 (with caveat), AC-10, AC-13

- **Phase C — production hardening** (gated on first consumer deployed):
  - `ratelimit.ts` — token bucket; AC caveat for per-instance limit
  - SIGTERM graceful shutdown (AC-11)
  - `/openapi.json` cross-validated against `routes/` at boot
  - Module `registerApi` opt-in audit (one new module per change)

- **Evidence run** (per `docs/evidence/` convention):
  - Boot the API in a fresh worktree
  - Seed two tenants (overlapping identifiers per AC-3)
  - Exercise every AC, snapshot pass/fail
  - Save under `docs/evidence/016-platform-api/`

The phases roll into `tasks.md` as `## N. Phase <X> — <status>` sections with `T-NN` lines once the gates clear.

---

## 3. Open questions for implementation

These are the questions that surface at *implementation* time, distinct from the *spec* open questions in Spec 016 §11 (which are all resolved). They live here as a parking lot for the implementer; not blocking on ratification.

- **P1 — Auth file format.** `DAEDALUS_API_KEYS_FILE` shape: flat `{ "<tenantId>": "<key>" }` is the proposal. Alternative: `{ "<tenantId>": { "key": "...", "rateLimit": 100 } }` for per-tenant overrides. Settle at impl; document the format in `apps/api/README.md`.
- **P2 — Boot order.** The API must register all module routes before binding the port. If a module's `registerApi` throws, do we (a) fail-fast and exit, or (b) log and continue with a degraded surface? Proposal: (a) — fail-fast. A test asserts the failure path.
- **P3 — `registerApi` discovery.** How does the API enumerate `@daedalus/*` packages? Options: read `package.json` workspaces, walk the filesystem, or have `@daedalus/core` expose a `listModules()` helper. Proposal: `@daedalus/core` exposes `listModules()` (returns the list of `registerApi` exports). One source of truth.
- **P4 — OpenAPI drift detection.** The hand-written `openapi.json` must mirror `routes/`. Two strategies: (a) a CI test parses `routes/` and asserts every route appears in the document, or (b) a generated diff at boot fails the server if the document is stale. Proposal: (a) at first; (b) when the surface gets big.
- **P5 — Idempotency payload hashing.** When a client replays a request, the API hashes the body and compares to the cached hash. SHA-256 of the canonicalized JSON body. Settle at impl; document the canonicalization rule.
- **P6 — First consumer contract.** Activation criterion #6 requires naming the first consumer. Candidates: a Cloud Run job, a CI workflow, an agent (post-Phase 4), an integration. The choice shapes Phase A's "minimum read surface" — a CI consumer needs events, a Cloud Run job needs commands, an agent needs both. Settle before Phase A; the consumer's first use case is the first T-NN.

---

## 4. Definition of done (when build is authorized)

A phase is **done** when:
- The T-NN tasks in `tasks.md` are all `- [x]` for that phase.
- `node --test apps/api/tests/` is green for the phase's AC tests.
- `tools/scripts/check-spec-conventions.mjs` is clean.
- An evidence run is recorded under `docs/evidence/016-platform-api/`.
- A PR is opened and merged with the canonical commit-message format.
- Theia (when run) shows `16 / 16` (or current count) for spec 016 with the phase marked Shipped.

The **overall spec** is done when all phases ship, the `registerApi` parity test is green against the live CLI, the OpenAPI document validates, and Atlas/Theia are unaffected (their tokens, panels, and test suites stay green).

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), and the [Roadmap](../../docs/roadmap.md). Forward-planning companion to [Spec 016 v0.2.0](./spec.md). Build authorization is gated on Spec 016 §13.*
