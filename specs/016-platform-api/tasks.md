# Tasks — Platform API

**Status:** Draft (planning; build not authorized) · **activation 5/6 cleared (gates #1 #2 #3 #4 #5) · 1 gate remaining (#6 first consumer named, tracked as PR #119 / ADR-013)**
**Derives from:** [Spec 016 v1.0.0](./spec.md) (Ratified) + [Plan 016 v1.0.0](./plan.md) (Ratified) + [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) (Accepted) + [PR #117 evidence](../../apps/cli/src/commands/registry.ts) (CLI registry enumerated)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 0.5.0
**Last updated:** 2026-07-01

> Draft — Spec 016 is Ratified, ADR-010 is Accepted, the CLI registry is enumerated, the `registerApi` hook signature is locked, and the first consumer is named as a Cloud Run job (gates #1, #2, #4, #5, #6 cleared by #115, #116, #117, #118, #119). **One gate remains:** Spec 009 wired for HTTP (gate #3). T-01…T-N may not begin per the spec's binding language until all six clear.
>
> This `tasks.md` exists in canonical Draft form so the Spec 015 linter passes and Theia reports the spec correctly (0 / 0 tasks, Draft status) while planning continues.

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

## 2. v0 build — Draft

*(none yet — see Spec 016 spec.md §4 for the v0 route table, §7 for the binding
constraints, §8 for the 13 acceptance criteria that will become the T-NN task
source, and §13 for the activation gates above. The first task to land will
be T-01 — likely `apps/api/` scaffolding — once all six gates clear.)*
