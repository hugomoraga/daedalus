# ADR-010 — Add the Platform API as a programmatic driving adapter

**Status:** Accepted
**Date:** 2026-07-01 (originally proposed 2026-06-22; accepted 2026-07-01 via PR #116, on the back of Spec 016 ratification in PR #115)
**Deciders:** Stewards
**Trigger:** [Spec 016 — Platform API](../../specs/016-platform-api/spec.md) drafted (v0.2.0 on branch `016-platform-api`, since Ratified in PR #115); the platform is moving toward Cloud Run, Agent Runtime (Phase 4), and multi-tenant operations (Phase 5), all of which need programmatic access to the platform's use cases.
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-003](./ADR-003-modular-monorepo.md), [ADR-004](./ADR-004-export-discipline-and-lineage.md), [ADR-005](./ADR-005-atlas-driving-adapter.md) (parallels), [Spec 009](../../specs/009-policy-engine/spec.md), [Spec 011](../../specs/011-workflow-engine-projections/spec.md), [Spec 012](../../specs/012-theia/spec.md), [Spec 016](../../specs/016-platform-api/spec.md)

---

## Context

Daedalus's organizational Core ships a use case registry that today has exactly one driving surface: the CLI ([`apps/cli/`](../../apps/cli/)). The CLI is the right tool for interactive operator work, but it is the wrong tool for:

- **Cloud Run jobs and services** — serverless workloads that need to call use cases over HTTP, not by shelling out.
- **Agents (Phase 4)** — autonomous executors that interact with the platform over a stable contract, not by parsing CLI output.
- **CI workflows** — automated pipelines that need to issue commands reproducibly across machines and environments.
- **Integrations** — third-party systems (and the future Tenant Portal — [see the app landscape in `docs/repository-structure.md`](../../docs/repository-structure.md)) that must call the platform without depending on the CLI binary.

The Technical Principles §"Avoid for now" list includes **"Public API"** — placed there to prevent premature API adoption before the platform's use case surface, policy layer, and projection boundaries were real. That condition has now flipped:

- The use case registry is bounded and stable (CLI's `case "..."` set is enumerable per Spec 016 AC-12).
- The Policy Engine (Spec 009) is being ratified, which gives the API a real `evaluateAndRecordPolicy` to call for every write.
- The event store and projection surface are tenant-scoped and replayable — the read side of the API has stable consumers.
- The platform needs to be operable by machines, not just humans.

Today, the absence of an API is a real friction: any programmatic consumer either depends on the CLI as a subprocess (fragile, hard to test, no shared auth, no idempotency, no lineage propagation) or invents its own backdoor into the Core (which would bypass the discipline). Neither is acceptable for a system that values *Auditability by Default* (Constitution Principle 4) and *Simplicity First* (Principle 9).

[Spec 016](../../specs/016-platform-api/spec.md) defines the **Platform API**: a programmatic driving adapter parallel to `apps/cli/` and `apps/atlas/`. It is a composition root; it contains no business logic. It dispatches to use cases; every write passes through policy and emits a `DomainEvent` with lineage.

This ADR records the architectural decision: **the Platform API is admitted as a programmatic driving adapter**, and the "Public API" item in the Avoid-for-now list is **conditionally retired** — only for the Platform API as defined in Spec 016, and only when its binding constraints (no business logic, no new Core primitives, multi-tenant by default, writes policy-bound, zero external deps) hold.

---

## Decision

1. **Add `apps/api/` as a third programmatic driving adapter**, peer to `apps/cli/` and `apps/atlas/`. It is a composition root; it contains no business logic. It dispatches HTTP requests to use cases; the use cases dispatch to the Core and modules through the same ports the CLI uses.

2. **The contract is the use cases.** The CLI and the API are two surfaces of the same contract. A use case added to one is added to both, called from the same handler. Per Spec 016 AC-12, an automated parity test enumerates the use case registry and fails if either surface lags. The platform's auditability (Constitution Principle 4) is preserved because the audit trail (event store) is unchanged — only the surface that emits the events changes.

3. **Conditionally retire the "Public API" item** in [Technical Principles §"Avoid for now"](../../memory/technical-principles.md). The retirement applies **only** to the Platform API as defined in [Spec 016](../../specs/016-platform-api/spec.md). The general principle against premature API work stands; this is a named exception, parallel to how [ADR-005 §2](./ADR-005-atlas-driving-adapter.md) conditionally retired "Web UI" for ATLAS. Any future expansion beyond the Platform API as specified — webhook receivers, third-party integration surfaces, browser-facing APIs — requires its own spec amendment and a fresh ADR.

4. **Do NOT retire the "Complex auth" item.** The Platform API v0 uses **per-tenant API keys** via `Authorization: Bearer <key>` — a simple, low-ceremony auth model suitable for programmatic access. OAuth 2.0 / JWT (which would qualify as "Complex auth") is explicitly deferred to v1 / Phase 5, and any introduction of complex auth requires its own ADR.

5. **Reads are available from v0; writes are gated on the Policy Engine (Spec 009) being able to evaluate HTTP-shaped requests.** Until Spec 009 is wired to evaluate API requests, `POST /v1/tenants/:tenantId/commands/...` returns `503` with `{"error":"policy_unavailable",...}` (Spec 016 AC-13). The v0 read surface is not blocked on Spec 009. This is the same discipline as ADR-005's "no write paths in ATLAS": the platform is built one capability at a time, in the order the canon allows.

6. **Multi-tenant by construction.** Every API request carries a `tenantId`. The API rejects requests where the authenticated principal is not authorized for the tenant (`403`). Cross-tenant operations are explicitly out of scope (Spec 016 §9). The v0 idempotency store is per-instance, per-tenant (Spec 016 AC-9 documents the v0 caveat; a future spec addresses shared storage).

7. **Zero external runtime dependencies.** `apps/api/package.json` declares no `dependencies`. The HTTP server is Node 22 native (`http.createServer`), JSON is native, no Express, no Fastify, no ORM, no SDK. Same discipline as ADR-005 §5 for ATLAS. The CI-blocking dep linter (Spec 016 AC-8) enforces it.

8. **Auth is applied at the *router* level**, not per route. Every `/v1/tenants/...` route is wrapped by the auth middleware. A future contributor adding a route cannot bypass auth without explicitly removing the wrapper — which the AC-2 test enumerates and detects.

9. **Modules opt in to HTTP exposure via a `registerApi(router, ctx) → void` hook.** Modules that omit the hook are not exposed over HTTP; their use cases remain CLI-only. This preserves the modular-evolution discipline (Constitution Principle 7) — adding a module does not implicitly add an API surface.

10. **Activation is gated, not speculative.** Per [Spec 016 §13](../../specs/016-platform-api/spec.md), the build begins only when six gates clear: spec ratification, this ADR accepted, Policy Engine ready to evaluate HTTP requests, CLI use case registry enumerated, `registerApi` hook signature locked, and **a first consumer named** (a Cloud Run job, an agent, a CI workflow, or an integration). v0 does not build speculatively.

---

## Consequences

**Positive**

- **Machine operability without subprocess fragility.** Agents, CI, integrations, and Cloud Run jobs can drive the platform over HTTP. No shell-out, no parsing of CLI output, no per-environment binary.
- **Same auditability discipline as the CLI.** Every write still flows through a use case, the use case still passes through policy (Spec 009), the resulting `DomainEvent` is still recorded with full lineage (`eventId`, `tenantId`, `type`, `payload`, `occurryedAt`, `actor`, `causationId`, `correlationId`, `version`). The audit trail is unchanged.
- **Reuse of Canon discipline.** Hexagonal layering, export discipline (ADR-004), event-first design, line-by-line lineage, multi-tenant isolation, zero-deps — all of it carries over from the existing surfaces. No new patterns introduced.
- **Idempotency for writes.** The `Idempotency-Key` header (Spec 016 AC-5) gives clients a safe retry story that the CLI does not natively provide. This is a strict improvement over subprocess invocation.
- **Discoverability via OpenAPI 3.1.** `/openapi.json` is hand-written and validated in CI (AC-7). Future consumers don't need to read source code to learn the surface.
- **Composable with future surfaces.** The same `registerApi(router, ctx)` hook that the canonical HTTP adapter calls today can be reused by future adapters (e.g. a webhook receiver, a gRPC bridge) without changing the modules.

**Negative / risks**

- **API surface drift.** A future contributor adds a route that bypasses use cases (e.g. a "raw event emission" shortcut). *Mitigation:* Spec 016 §9 binding non-goal "no write paths that bypass use cases"; the `registerApi` hook only exposes use cases, not raw event emission; the parity test (AC-1, AC-12) enumerates use cases and fails on bypass.
- **Auth bypass.** A future contributor adds a route without the auth middleware. *Mitigation:* auth is at the router level (Decision 8), not per route. AC-2 enumerates every route and verifies each is guarded.
- **Tenant leakage.** Cross-tenant reads or writes via a forged `tenantId` in the URL. *Mitigation:* Spec 016 AC-3 + a dedicated two-tenant isolation test against seeded events.
- **Idempotency store growth and cross-instance divergence.** The v0 in-process idempotency cache grows without TTL; cross-instance dedup is not honored. *Mitigation:* TTL-based eviction (24h) within the instance; the AC-9 test documents the v0 caveat; a future spec addresses shared storage when Cloud Run multi-instance becomes a real workload.
- **Policy denial information leak.** A denial response leaks the policy's internal rules. *Mitigation:* responses carry a stable code (`policy_denied`) and a human message, not the policy's internal rule bodies. AC-4 asserts no rule bodies are leaked.
- **Canon deviation overreach.** The Platform API expands beyond its named exception (e.g. someone adds CORS in v0, opens raw event emission, adds OAuth without an ADR). *Mitigation:* Spec 016 §9 (non-goals) and §12 (out of scope) are binding; this ADR records the deviation and the evidence; any expansion beyond the named exception requires its own spec amendment + ADR.
- **`registerApi` opt-in confusion.** A module author forgets to export `registerApi` and the module's use cases become CLI-only silently. *Mitigation:* AC-12 surfaces the parity test failure; the hook signature is locked in Decision 9; a short "how to expose a module" doc accompanies the spec.
- **Cold start on Cloud Run.** First request after idle is slow. *Mitigation:* documented; optimization is a Cloud Run config concern (min-instances, warmup), not a code concern.
- **Build blocked on Spec 009.** Writes are gated on the Policy Engine. If Spec 009 takes longer than expected, the v0 read surface ships first and writes land later. *Mitigation:* reads are unblocked from v0; the write path is a separate, gated phase. This is the same staged-landing discipline used elsewhere (e.g. ADR-005's read-only ATLAS before any UI writes).
- **Activation gate #6 (first consumer named).** The build is explicitly not speculative. If the first consumer is never named, the build does not start. *Mitigation:* this is a feature, not a bug — Simplicity First (Constitution Principle 9) and the existing build authorization discipline require a real demand signal.

**Cost**

- `apps/api/` adds a Node 22 HTTP process (single port, ~2s cold start on a warm machine). No new build step, no new infrastructure beyond what Cloud Run already requires.
- One new package (`@daedalus/api`) with `dependencies: {}`. The npm workspace symlinks resolve without changes.
- 11 acceptance-criteria tests (per Spec 016 §8); the existing tests stay green.
- One new ADR (this one) and one new spec (016, already drafted).
- One new `docs/evidence/016-platform-api/` run when the build is authorized.

---

## What this ADR does NOT do

- Does **not** authorize any new Core event type, aggregate, projection, or port. The API is a pure consumer + dispatcher.
- Does **not** authorize OAuth / JWT / "complex auth" in v0. API keys only; complex auth requires its own ADR.
- Does **not** authorize CORS, cookies, or any browser-specific concerns in v0. Server-to-server only.
- Does **not** authorize SSE, WebSocket, webhooks, or any push mechanism in v0. Pull-based reads only.
- Does **not** authorize a "raw event emission" endpoint in v0. All writes go through use cases.
- Does **not** authorize cross-tenant operations, bulk operations, or any operation that aggregates across tenants.
- Does **not** authorize a new visual design system or any coupling to Atlas's tokens. The API has no UI.
- Does **not** authorize LLM integration or any third-party service connection in v0.
- Does **not** change the Constitution, the [Identity](../../docs/identity.md) document, the [Domain Model](../../docs/domain-model.md), the [Roadmap](../../docs/roadmap.md), or any ratified spec's intent.
- Does **not** retire "Public API" from the Avoid-for-now list in general. The list keeps its teeth for any API work that does not match the Platform API's constraints.

---

## Acceptance (gate for steward ratification)

This ADR moves the Platform API into the roadmap only when **all** of the following hold:

1. **[Spec 016](../../specs/016-platform-api/spec.md) is ratified.** ✅ Cleared in PR #115 (`docs(specs/016): ratify Platform API — gate #1 cleared, 1/6`). Spec 016 is now Ratified v1.0.0; spec §11 Q1–Q12 are closed; spec §13 carries an activation-status table.
2. **The steward ratifies this ADR explicitly.** ✅ Cleared in this PR (#116). This ADR moves from Proposed → Accepted on 2026-07-01.
3. **The activation criteria in Spec 016 §13 are reachable.** That is, the Policy Engine (Spec 009) is on a path to be able to evaluate HTTP-shaped requests, the CLI use case registry is enumerable, and a first consumer (Cloud Run / agent / CI / integration) is identified or at least named in the near-term roadmap. ⏳ Reachable, in progress. Pre-PR-#116 snapshot: gates 3 / 4 / 6 (Spec 009 HTTP wiring, CLI registry baseline, first consumer) are pending follow-up PRs; gate 5 (the `registerApi` hook signature) was locked by Spec 016 §11 Q5 in #115 and its module-opt-in implementation tracks as a separate PR.

Once ratified, the T-01…T-N in `specs/016-platform-api/tasks.md` may begin only when the six gates in Spec 016 §13 clear, in order. The acceptance of this ADR is **not** pre-approval of the build; it is the architectural authorization that, combined with the spec's gate-driven build start, removes one more dependency from the build's own sequence.

---

## Companion change: Roadmap amendment

This ADR ships together with a minimal amendment to the [Roadmap](../../docs/roadmap.md):

- The Platform API v0 is positioned as a **Phase 2/3 capability**, unblocking Phase 4 (Agent Runtime) and Phase 5 (multi-tenant operations on Cloud Run). It is not a new phase; it is a horizontal capability that other phases consume.
- The Platform API is explicitly **not on the critical path** of Tenant 0's daily operations today — Tenant 0 uses the CLI. The API exists to unblock future phases and external consumers; it does not accelerate any current roadmap phase.

No other sections of the roadmap change. Phase 0, 1, 4, 5 are unaffected.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Technical Principles](../../memory/technical-principles.md). A named exception to the "Public API" item in the Avoid-for-now list — not a reversal of the principle. Parallels [ADR-005](./ADR-005-atlas-driving-adapter.md) (which authorized a read-only UI for tenants) by authorizing a programmatic driving adapter for machines.*
