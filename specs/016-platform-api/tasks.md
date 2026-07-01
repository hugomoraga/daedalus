# Tasks — Platform API

**Status:** Phase A in progress · **activation 6/6 cleared** · **T-01 ✅ shipped in #121** · **T-02–T-04 next**
**Derives from:** [Spec 016 v1.0.0](./spec.md) (Ratified) + [Plan 016 v1.0.0](./plan.md) (Ratified) + [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) (Accepted) + [ADR-013](../../governance/decisions/ADR-013-cloud-run-job-first-consumer.md) (Accepted) + [PR #117 evidence](../../apps/cli/src/commands/registry.ts) (CLI registry enumerated) + [PR #120 evidence](../../../tests/policy-engine-http-shaped.test.ts) (HTTP-shaped policy action)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 1.1.0
**Last updated:** 2026-07-01

> Phase A T-01 ✅ shipped (PR #121). The remaining Phase A tasks are T-02 (auth + tenant resolver — closes AC-2), T-03 (read paths — closes AC-3, AC-9 reads, AC-12 reads), and T-04 (`registerApi` integration + OpenAPI cross-check — closes the full AC-7). Phase B (writes through Policy Engine) and Phase C (production hardening with `app/service` SIGTERM and rate limiting) are gated on Phase A + the ADR-013 first consumer. Each T-NN is its own PR; the [Plan §2 phase breakdown](../../specs/016-platform-api/plan.md) is the canonical ordering.

---

## 1. Reality check

- **v0 status: planning.** No code yet.
- **Activation gates per spec.md §13** (all required before T-01 begins):
  1. Spec 016 ratified by stewards. ✅ Cleared (#115).
  2. [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) (or equivalent) accepted — authorizes the deviation from the "Public API" item in the Technical Principles §"Avoid for now" list. ✅ Cleared (#116).
  3. Policy Engine (Spec 009) can evaluate HTTP-shaped request contexts; AC-13 ("policy unavailable → 503") is green. ✅ Cleared (#120). Evidence: [`tests/policy-engine-http-shaped.test.ts`](../../../tests/policy-engine-http-shaped.test.ts) — 5 cases demonstrating `evaluateAndRecordPolicy` accepts HTTP-shaped `PolicyAction`s (actionType + `context.{method, path, headers, lineage, payload}`) and emits `PolicyDecisionRecorded` with the caller's actor preserved, the request's lineage, and one of `allow` / `deny` / `escalate`. Two implementations involved: (a) `appendIntents(deps, tenantId, intents, lineage, actorOverride?)` now accepts an optional actor override (the seam the API uses to record the principal — Spec 016 §8 AC-10); (b) `evaluateAndRecordPolicy` forwards `input.actor` as that override. The HTTP-→-PolicyAction adapter lives in `apps/api/` (Phase B, future PR).
  4. CLI use case registry enumerated; AC-12 baseline exists. ✅ Cleared (#117). Evidence: [`apps/cli/src/commands/registry.ts`](../../../apps/cli/src/commands/registry.ts) (the runtime registry), [`apps/cli/tests/registry.test.ts`](../../../apps/cli/tests/registry.test.ts) (the baseline invariants: 7 tests pinning sort order, dedup, char shape, colon-form check, drift detection between `CLI_HANDLERS.keys()` and `CLI_COMMAND_NAMES`, and anchor regression for the AC-1 evidence commands). [Theia's parser](../../tools/theia/src/parser/use-cases.ts) is the independent static-analysis source of truth and catches any drift between registry and per-command file patterns.
  5. `registerApi(router, ctx) → void` hook signature locked (Q5 resolution). ✅ Q5 resolution in spec §11 locks the signature; module opt-in implementation tracked as a separate PR (the gate is closed on signature, not on implementation).
  6. First consumer named (a Cloud Run job, an agent, a CI workflow, or an integration) — v0 does not build speculatively. ✅ Cleared (#119) — [ADR-013](../../governance/decisions/ADR-013-cloud-run-job-first-consumer.md) names **daily-financial-snapshot-job**: a single-tenant (tenant-0), daily-cadence (00:00 UTC), Cloud-Run-job cron that reads the live `FinancialSummary` projection + the last 24h of `FinancialRiskFlagged` events, then writes a `RevenueSnapshotGenerated` via `POST /v1/tenants/tenant-0/commands/revenue/snapshot`. Concrete read+write surface for Phase A and Phase B; the smallest cron that exercises reads + writes + policy + tenant scoping + idempotency + lineage headers + OpenAPI discoverability.

---

## 2. v0 build

Tasks roll in from [Plan 016 §2](../../specs/016-platform-api/plan.md) (Phase A / B / C). Each T-NN is its own PR; the references below point at the PR that lands each, and the test plan §6 lists the AC each T clears.

### Phase A — read paths only (gated on Spec 016 ratified + ADR-010 accepted; no Policy Engine dependency for reads)

- [x] T-01: `apps/api/` scaffolding. SHIPPED in PR #121. Files: `apps/api/package.json` (`dependencies: {}` per AC-8), `apps/api/src/server.ts` (Node 22 native `http.createServer`; SIGTERM handler; bound 0.0.0.0 with `PORT` env override), `apps/api/src/router.ts` (exact-path dispatch), `apps/api/src/routes/health.ts` (`/healthz` + `/readyz` per AC-6), `apps/api/src/routes/openapi.ts` (`/openapi.json` per AC-7), `apps/api/src/openapi.json` (hand-written OpenAPI 3.1, AC-4 Q4), `apps/api/src/readiness.ts` (event-store-reachable probe, duck-typed vs Core's `EventStorePort` so the package stays dep-less per AC-8), `apps/api/src/errors.ts` (canonical envelope), `apps/api/src/lineage.ts` (`X-Causation-Id` / `X-Correlation-Id` per AC-10), `apps/api/src/cli.ts` (`daedalus-api serve [--port N]`). Tests: `apps/api/tests/api-deps.test.ts` (AC-8), `apps/api/tests/api-health.test.ts` (AC-6), `apps/api/tests/api-openapi.test.ts` (AC-7 slice).
- [ ] T-02: Auth middleware (env file + per-tenant env var per Q10) + tenant resolver + isolation middleware. Closes AC-2. Tracking as PR #122.
- [ ] T-03: Read paths: `GET /v1/tenants/:tenantId/events[/:eventId]` + `GET /v1/tenants/:tenantId/projections/:name` + `GET /v1/tenants/:tenantId/obligations` (after Spec 004 module opts in) + `GET /v1/tenants/:tenantId/workflows/instances[/:id]` (after Spec 011 module opts in). Closes AC-3, AC-9 (stateless horizontal scaling for reads), AC-12 (CLI ↔ API parity baseline).
- [ ] T-04: `registerApi(router, ctx) → void` hook integration + module opt-in walk + OpenAPI cross-validation. Closes AC-1 / AC-12 surface (parity across CLI + API) + AC-7 (full).

### Phase B — write paths (gated on Spec 009 ready to evaluate HTTP requests; closed by #120)

- [ ] T-05: `routes/commands.ts` — `POST /v1/tenants/:tenantId/commands/:useCase` per Q3 (`':' → '/'`). Closes AC-4 (policy-bound writes) + AC-13 readiness (writes still return 503 until policy is wired for HTTP at the application layer — gate #3 verified HTTP *evaluation*, this closes the API-side wiring).
- [ ] T-06: `policy.ts` — `evaluateAndRecordPolicy` wrapper, lineage propagation into `causationId`/`correlationId` of the resulting `DomainEvent`. Closes AC-10 (lineage headers → event lineage).
- [ ] T-07: `idempotency.ts` — TTL-based eviction in the in-process store. Closes AC-5, AC-9.

### Phase C — production hardening (gated on first consumer deployed; named by ADR-013)

- [ ] T-08: `ratelimit.ts` — per-tenant token bucket (100 req/s default, env-configurable). Closes Q11 caveat.
- [ ] T-09: SIGTERM graceful shutdown (configurable timeout, default 30s, env `API_SHUTDOWN_TIMEOUT_MS`). Closes AC-11.
- [ ] T-10: `/openapi.json` cross-validation against `routes/` at boot. Final AC-7 stricter check.
- [ ] T-11: `registerApi` opt-in audit (each module documents its `registerApi` hook + integration test). Final AC-12 / AC-1.
