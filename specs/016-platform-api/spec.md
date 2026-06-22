# Spec 016 — Platform API

**Status:** Draft
**Type:** Driving adapter — programmatic HTTP surface for the Daedalus Core and modules
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* the Platform API is and *why*, not *how*. Conceptual — no JSON shapes, no handler code, no OpenAPI generator. The OpenAPI document (AC-7) is the operational surface, not this spec.

> **Canon tension — flagged early.** The [Technical Principles](../../memory/technical-principles.md) §"Avoid for now" list includes **"Public API"** and **"Complex auth"**. The Platform API is a *named exception* to the first (mirroring how [ADR-005](./ADR-005-atlas-driving-adapter.md) admitted ATLAS as a named exception to "Web UI"). The spec is conditional on a parallel **ADR-009** (or equivalent) that records the deviation and the evidence justifying it (Cloud Run deployment, Agent Runtime need, CI/integrations, programmatic operability). Until that ADR is accepted, this spec is **not authorized**. For auth, v0 uses **per-tenant API keys** — not the "complex auth" item (OAuth/JWT is deferred to v1 / Phase 5, with its own ADR if it ever lands). Reads are available from day one; **writes are gated on the Policy Engine (Spec 009) being able to evaluate API requests** (a `PolicyDecisionRecorded` event must be recorded for every write).

> **Naming.** The path is `apps/api/`; the package is `@daedalus/api`. "Platform API" distinguishes it from any future *module-level* APIs (e.g. a third-party integration that exposes a webhook to a module). The Platform API is the single canonical HTTP surface of the platform.

---

## 1. Summary

The Platform API is a **programmatic driving adapter** parallel to `apps/cli/` and `apps/atlas/`. It exposes the platform's use cases over HTTP, so agents, CI, integrations, and Cloud Run can operate Daedalus without invoking the CLI as a subprocess. **No business logic lives in the API.** It is a composition root: HTTP routes dispatch to use cases; every use case is bound by policy (Spec 009) and emits a `DomainEvent` with lineage.

The contract is the use cases. The CLI and the API are **two surfaces of the same contract** — if a use case exists, it appears in both. The Platform API is multi-tenant by construction, authenticated, designed for 12-factor / Cloud Run (stateless, env-based config, `/healthz` + `/readyz`), and ships with **zero external runtime dependencies** (Node 22 native HTTP, native JSON, no Express, no ORM, no SDK).

> **What this is NOT.** Not a UI. Not a webhook receiver. Not a streaming API. Not a public, unauthenticated endpoint. Not a CRM. Not a replacement for the CLI. The CLI remains the canonical interactive surface; the API is the canonical programmatic surface.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Generic Core, Specific Tenants* (the API is tenant-agnostic, multi-tenant from day one — Tenant 0 is one tenant, not the definition); *Auditability by Default* (every write emits a `DomainEvent` with full lineage); *Policy before Agent* (every write passes `evaluateAndRecordPolicy` per Spec 009 before mutation, with a `PolicyDecisionRecorded` event recorded); *Simplicity First* (Node 22 native HTTP, no framework, zero deps); *Tenant Isolation* (every request is tenant-scoped; the API never aggregates across tenants). |
| **[Technical Principles](../../memory/technical-principles.md)** | Respects hexagonal layering. The API is a *driving adapter*; it calls use cases in `@daedalus/core` and modules through their public contracts. It does not bypass ports; it does not import adapter internals. The dependency rule `apps → packages` holds. The "Public API" item in the §"Avoid for now" list is **conditionally retired by this spec, gated on ADR-009** (parallel to how ADR-005 retired "Web UI" for ATLAS). The "Complex auth" item is **not** retired — v0 uses API keys (simple); OAuth/JWT (complex) is deferred and requires its own ADR if it ever ships. |
| **[Identity](../../docs/identity.md)** | The API sits in the **driving adapter** layer, parallel to the CLI and Atlas. It is not a Module, not Core, not a Tenant. It does not change the platform/tenant boundary. |
| **[Roadmap](../../docs/roadmap.md)** | The API is required for Phase 4 (Agent Runtime) and Phase 5 (multi-tenant operations on Cloud Run). v0 lands as soon as the Policy Engine (Spec 009) can evaluate API requests — Phase 2/3 boundary. The API does **not** accelerate roadmap phases; it removes a Phase 4/5 blocker. |
| **[Event Catalog](../../docs/event-catalog.md)** | The API writes by emitting `DomainEvent`s through the Core's `EventStorePort`; reads by querying the store via projections. Same vocabulary. The API defines no new event types. |
| **Specs 007 (Atlas), 012 (Theia)** | The API is **peer** to Atlas and Theia, not a replacement. Atlas stays read-only, human-facing, observability. Theia is a dev tool for the repo. The API is programmatic, machine-facing, write+read. They share no code at runtime. |
| **Spec 009 (Policy Engine)** | The API calls `evaluateAndRecordPolicy` for every write use case. The policy decision is recorded as a `PolicyDecisionRecorded` event in the same lineage. **Writes are gated on Spec 009 being able to evaluate API requests** — until then, the API is read-only. |
| **Spec 011 (Workflow Engine Projections)** | The API exposes workflow read models (active processes, queue, metrics) over HTTP. |
| **Spec 004 (Tax & Compliance Guard)** | The API exposes the module's read models (obligations) over HTTP. Modules opt in via a `registerApi(router, ctx)` hook — see §5. |

---

## 3. Goals

1. **Same actions, different surface.** Every use case the CLI exposes appears as an HTTP endpoint. The CLI and the API are two views of the same contract; a use case added to one is added to both.
2. **Operable from machines.** Agents, CI, integrations, and Cloud Run can drive the platform over HTTP. No subprocess, no parsing CLI output, no shelling out.
3. **Multi-tenant by default.** Every request carries a `tenantId`. The API never queries across tenants. Auth is enforced on every request (except `/healthz` and `/readyz`).
4. **Governed writes.** Every write passes through `evaluateAndRecordPolicy` (Spec 009) and emits a `DomainEvent` with lineage (`eventId`, `tenantId`, `type`, `payload`, `occurredAt`, `actor`, `causationId`, `correlationId`, `version`). No direct adapter mutation, no bypassing ports.
5. **12-factor / Cloud Run ready.** Stateless, env-based config, `/healthz` + `/readyz` for liveness/readiness, graceful shutdown on `SIGTERM`, no in-process state that prevents horizontal scaling.
6. **Zero external runtime dependencies.** Native Node 22 HTTP, native JSON. `dependencies` in `apps/api/package.json` is `{}`. No Express, no Fastify, no ORM, no SDK.
7. **Idempotency for writes.** Writes accept an `Idempotency-Key` header. Replays with the same key and same payload return the original result, not a duplicate event. Same key with a different payload returns `409`.
8. **Versioned from day one.** URL-path version (`/v1/...`). Breaking changes require `/v2/...` and a parallel spec amendment + ADR.
9. **Discoverable.** v0 ships `/openapi.json` (OpenAPI 3.1, hand-written, validated in CI) covering every endpoint in the v0 surface. The route table in §4 is the source of truth; the OpenAPI document mirrors it.
10. **Aligned with the "named exception" pattern.** The API is admitted as a single, named exception to the Avoid-for-now list — not a blanket reversal. The exception is bound by this spec's non-goals (§9) and out-of-scope (§12).

---

## 4. What the API reads vs what it does not

### Reads (read paths, no side effects)

| Method | Path | Effect |
|---|---|---|
| `GET` | `/healthz` | Liveness — the Node process is running. No external checks. Anonymous. |
| `GET` | `/readyz` | Readiness — event store reachable; projections computable. Anonymous. |
| `GET` | `/openapi.json` | OpenAPI 3.1 document covering the v0 surface. Anonymous. |
| `GET` | `/v1/tenants/:tenantId/events` | List events for the tenant. Paginated (`?limit`, `?after`), filterable (`?type`, `?since`, `?until`). |
| `GET` | `/v1/tenants/:tenantId/events/:eventId` | One event with full lineage. |
| `GET` | `/v1/tenants/:tenantId/projections/:name` | A named projection's current state. `:name` is declared by the module that owns the projection. |
| `GET` | `/v1/tenants/:tenantId/obligations` | Tax compliance obligations (Spec 004 read model). |
| `GET` | `/v1/tenants/:tenantId/workflows/instances` | List workflow instances (Spec 011). Paginated, filterable. |
| `GET` | `/v1/tenants/:tenantId/workflows/instances/:id` | One workflow instance with state and history. |

> v0 is intentionally small. New read endpoints are added by appending to this table (and the OpenAPI document) when a new module opts in via `registerApi`.

### Writes (governed, multi-tenant, idempotent, policy-bound)

| Method | Path | Effect |
|---|---|---|
| `POST` | `/v1/tenants/:tenantId/commands/:useCase` | Execute a use case. The `:useCase` slug is the CLI command's `case "..."` value, lowercased with `:` → `/` (e.g. `proposal:approve` → `proposal/approve`). Body: `{ "payload": <object>, "metadata": <object> }`. Headers: `Authorization: Bearer <api-key>`, `Idempotency-Key: <uuid>` (recommended), `X-Causation-Id: <uuid>` (optional), `X-Correlation-Id: <uuid>` (optional). Response: `{ "result": <object>, "eventId": <uuid>, "requestId": <uuid> }`. |

> **No "raw event emission" in v0.** A `POST /v1/tenants/:tenantId/events` endpoint is **reserved** for future use (replay tools, event-sourcing interop) but is **not exposed** in v0. All writes go through use cases. This is binding (Q6 in §11).

### Does NOT do (binding non-goals)

- The API does not import from `@daedalus/*` *internals*. It only consumes the public contracts of `@daedalus/core` (use cases, ports, domain types) and the modules that opt in via `registerApi`.
- The API does not write to disk, log to a file, or maintain state across requests beyond the event store and the idempotency store.
- The API does not connect to external services in v0 (no LLM, no third-party APIs). v0 is local + Cloud Run only.
- The API does not implement business logic. Every handler dispatches to a use case.
- The API does not serve UI. No HTML, no SSR, no templates. JSON in, JSON out.
- The API does not subscribe to events (no SSE/WebSocket in v0). Reads are pull-based. Real-time push and webhooks are out of scope.
- The API does not implement the *full* surface of every module in v0. Each module opts in: a module exposes a `registerApi(router, ctx)` hook (see §5) that the API mounts at boot. Modules that haven't opted in are not exposed over HTTP.
- The API does not implement a custom protocol. HTTP, JSON, and OpenAPI 3.1 are the contract.

---

## 5. Domain concepts

- **Use case.** A typed operation in `@daedalus/core` or a module. Identified by a name (e.g. `proposal:approve`). The CLI and the API both dispatch to it. The use case name is the canonical identifier; the API URL slug is a deterministic transformation of it (`:useCase` → `proposal/approve`).
- **Command.** A request to execute a use case over HTTP. Carries the use case slug (in the URL), the `tenantId` (in the URL), the `payload` and `metadata` (in the body), and an `Idempotency-Key` (in the header).
- **DomainEvent.** A fact recorded in the event store. Has `eventId`, `tenantId`, `type`, `payload`, `occurredAt`, `actor`, `causationId`, `correlationId`, `version`. The API never invents new event types — it only emits events that the use case emits.
- **Idempotency key.** A client-supplied token (UUID recommended). The API stores `(idempotencyKey, tenantId, useCaseSlug) → result` for a bounded TTL (24h in v0). Replays with the same key + same payload return the original result. Same key + different payload returns `409`. Keys are scoped per tenant.
- **Projection.** A read model computed from the event stream. Modules expose named projections; the API exposes them under `/v1/tenants/:tenantId/projections/:name`. Projection names are stable strings declared by the module.
- **Multi-tenancy.** Every request carries a `tenantId`. The API rejects requests where the authenticated principal is not authorized for the tenant (`403`).
- **Auth.** v0: per-tenant API keys, supplied via `Authorization: Bearer <key>`. Keys are issued out-of-band (a future CLI command `api-key:create` is *not* required for v0 — keys may be provisioned by environment configuration in v0, with a CLI command coming in v1). Future (v1+): OAuth 2.0 / JWT, gated on its own ADR.
- **Lineage.** Every event written by the API carries `causationId` and `correlationId`. The API accepts these as headers (`X-Causation-Id`, `X-Correlation-Id`) and propagates them into the event. If absent, the API generates fresh UUIDs and returns them in the response headers (`X-Causation-Id`, `X-Correlation-Id`) for client reuse.
- **`registerApi(router, ctx)` hook.** Each module exports this function (or omits it, opting out of HTTP exposure). At boot, the API enumerates `@daedalus/*` modules, calls `registerApi` on each that exports it, and mounts the returned routes under `/v1/tenants/:tenantId/...`. `ctx` provides the event store, the policy engine, the tenant resolver, the idempotency store, and the use case registry. The hook signature is binding (Q5 in §11).

---

## 6. Events

The API does **not** define new event types. It dispatches to use cases; the use cases emit events. The API records the events through the standard `EventStorePort`.

For each command request, the API may emit a `PolicyDecisionRecorded` event (per Spec 009) when the policy engine is invoked. The API does not add new event types beyond what the Core and modules already define.

> **Why no new event types.** The API is a driving adapter. The Core's event catalog is the source of truth. A new use case may emit a new event type, but the use case (and the event) is owned by the Core or the module — not by the API.

---

## 7. Interaction constraints (binding)

- **Stateless.** No in-process state beyond a process-local idempotency cache. Any durable state lives in the event store or the idempotency store. Horizontal scaling is safe (with the documented caveat that v0 idempotency is per-instance — see Q2 in §11 and AC-9).
- **Idempotent writes.** A write with the same `Idempotency-Key` and same payload returns the original result. A write with the same key and a *different* payload returns `409 Conflict`.
- **Auth on every request** except `/healthz`, `/readyz`, `/openapi.json`. No anonymous reads of tenant data.
- **Tenant on every request.** No cross-tenant queries. The `tenantId` in the URL must match the tenant the auth principal is authorized for; mismatch returns `403`.
- **Policy on every write.** Writes go through `evaluateAndRecordPolicy`. A denied decision returns `403` with a body explaining the denial *category* (e.g. `"policy_denied"`) and a human message — **never the policy's internal rule bodies** (R5 in §10).
- **Versioned URL path.** All endpoints live under `/v1/`. Breaking changes require `/v2/...` and a parallel spec amendment + ADR.
- **No client-side state.** The API is server-stateful (event store, projections) but never trusts client state. No cookies, no sessions, no client-supplied state that mutates server behavior.
- **Graceful shutdown.** On `SIGTERM`, the server stops accepting new connections, finishes in-flight requests up to a configurable timeout (default 30s), then exits with code 0.
- **Standard error model.** All errors return JSON `{ "error": "<code>", "message": "<human readable>", "requestId": "<uuid>" }`. HTTP status codes are canonical:
  - `400` Bad Request — malformed input, missing header, malformed body
  - `401` Unauthorized — no API key, or invalid key
  - `403` Forbidden — policy denied, or tenant mismatch
  - `404` Not Found — unknown route, unknown event, unknown projection name
  - `409` Conflict — idempotency key reuse with different payload
  - `422` Unprocessable — body parses but fails use case validation
  - `429` Too Many Requests — rate limited (per-tenant, per-instance, v0)
  - `500` Internal Server Error — use case threw unexpectedly
  - `503` Service Unavailable — readiness failed
- **Rate limiting (best-effort v0).** Per-tenant rate limit (default 100 req/s) backed by an in-process token bucket. v0 acknowledges this is per-instance; cross-instance limiting is a future concern.
- **No CORS in v0.** The API is server-to-server. CORS is a v1 concern, gated on its own ADR (when browser-based clients land).

---

## 8. Acceptance criteria

**AC-1 (CLI ↔ API parity).**
- *Given* a use case registered in `@daedalus/core` or a module (e.g. `proposal:approve`),
- *When* a client calls `POST /v1/tenants/:tenantId/commands/proposal/approve` with the same payload the CLI would pass,
- *Then* the same handler is invoked, the same `DomainEvent` is emitted, and the response body's `result` shape mirrors what the CLI would have logged on success.
- *And* a test (`tests/api-cli-parity.test.ts`) enumerates every use case in the registry and asserts the parity for each.

**AC-2 (Auth on every tenant route).**
- *Given* the API is running,
- *When* a request arrives at any `/v1/tenants/...` route without `Authorization: Bearer <key>`,
- *Then* the API returns `401`. With a key issued for tenant B but a URL for tenant A, the API returns `403`. A test (`tests/api-auth.test.ts`) covers both paths for every registered route.

**AC-3 (Multi-tenant isolation).**
- *Given* two tenants with overlapping identifiers and seeded events,
- *When* a request targets tenant A with a tenant-A key,
- *Then* no data derived from tenant B events appears in the response. A dedicated test (`tests/api-tenant-isolation.test.ts`) exercises isolation against at least two seeded tenants, with at least one shared event type.

**AC-4 (Policy before write).**
- *Given* a write command that the policy engine denies,
- *When* the client calls the command endpoint,
- *Then* the API returns `403` with `{ "error": "policy_denied", "message": "<human>" }`, no event is written, and the `PolicyDecisionRecorded` event for the denial is recorded (per Spec 009) with the request's lineage.

**AC-5 (Idempotency).**
- *Given* a write with `Idempotency-Key: <uuid>` and a payload,
- *When* the same request is replayed with the same key and same payload,
- *Then* the API returns the original result (same body, same status) and does not write a second event. A second replay with the same key and a *different* payload returns `409 Conflict`.

**AC-6 (Health checks).**
- *Given* the API is running,
- *When* `GET /healthz` is called,
- *Then* the response is `200 {"status":"ok","version":"<api-version>"}` immediately (no external checks).
- *And* when `GET /readyz` is called, the response is `200 {"status":"ready"}` if the event store is reachable and projections can be computed; otherwise `503` with a body explaining the failed check.

**AC-7 (OpenAPI document).**
- *Given* the API,
- *When* `GET /openapi.json` is called,
- *Then* the response is a valid OpenAPI 3.1 document covering every endpoint in the v0 surface. A test (`tests/api-openapi.test.ts`) validates the document against the OpenAPI 3.1 JSON Schema and asserts that every registered route appears in the document.

**AC-8 (Zero external runtime dependencies).**
- *Given* the API's `package.json`,
- *When* inspected,
- *Then* `dependencies` is `{}`. No Express, no Fastify, no ORM, no SDK. A test (`tests/api-deps.test.ts`) greps `package.json` and fails if any `dependencies` entry is non-empty.

**AC-9 (Stateless horizontal scaling — with v0 caveat).**
- *Given* two API instances sharing the same event store and the same idempotency TTL,
- *When* the same `POST /v1/tenants/:tenantId/commands/<useCase>` with the same `Idempotency-Key` lands on each instance in sequence,
- *Then* the second instance returns `409 Conflict` (different in-process idempotency cache), and the event store holds exactly one event. The test asserts this and documents the v0 caveat (per-instance idempotency cache). A future spec addresses shared idempotency storage.

**AC-10 (Lineage propagation).**
- *Given* a write command with `X-Causation-Id: <uuid-A>` and `X-Correlation-Id: <uuid-B>`,
- *When* the command is executed,
- *Then* the resulting `DomainEvent` carries `causationId = uuid-A` and `correlationId = uuid-B`, and the `actor` reflects the API key's principal.
- *And* if the headers are absent, the API generates fresh UUIDs, includes them in the resulting event, and returns them in the response headers `X-Causation-Id` and `X-Correlation-Id`.

**AC-11 (Graceful shutdown).**
- *Given* the API is running and has an in-flight request,
- *When* it receives `SIGTERM`,
- *Then* it stops accepting new connections (existing connections are not reset), waits for in-flight requests to complete (up to the configured timeout, default 30s), then exits with code 0. A test (`tests/api-shutdown.test.ts`) starts the server, fires `SIGTERM`, and asserts the shutdown sequence.

**AC-12 (Use case registry parity).**
- *Given* `@daedalus/core` and the active modules,
- *When* the API boots,
- *Then* the command router is built from the use case registry. Adding a use case to a module (with a `registerApi` hook) makes it appear in both the CLI and the API automatically. A test (`tests/api-registry-parity.test.ts`) enumerates the use case registry at test time, asserts the CLI's `case "..."` set matches the API's `POST /v1/tenants/:tenantId/commands/...` set, and fails on any divergence.

**AC-13 (Spec-mandated write gating).**
- *Given* the Policy Engine (Spec 009) is **not** able to evaluate API requests (i.e. the API is built before Spec 009 is fully wired for HTTP contexts),
- *When* the API boots,
- *Then* the `POST /v1/tenants/:tenantId/commands/...` route returns `503` with `{"error":"policy_unavailable","message":"..."}` and the body documents the dependency. This is the only acceptable behavior pre-Spec-009. The test (`tests/api-policy-gating.test.ts`) runs against a built-but-policy-unwired instance and asserts the `503`.

---

## 9. Non-goals (binding)

- **No UI.** The API is JSON-only. No HTML, no SSR, no templates. No coupling to Atlas's design tokens.
- **No write paths in v0 that bypass use cases.** All writes go through use cases. A `POST /v1/tenants/:tenantId/events` direct-emission endpoint is **reserved** (in §4) but is **not exposed** in v0.
- **No SSE / WebSocket in v0.** Reads are pull-based. Real-time push, webhooks, and event subscriptions are deferred.
- **No cross-tenant operations.** A request is bound to one tenant. Cross-tenant reports, aggregates, or admin views are out of scope.
- **No CORS in v0.** The API is server-to-server. CORS is a v1 concern.
- **No LLM, no third-party integrations.** v0 is local + Cloud Run only.
- **No bulk operations in v0.** A request emits at most one event (or one batch governed by a single use case). Bulk emission is a future concern.
- **No new event types, aggregates, projections, or ports in `@daedalus/core`.** The API is a pure consumer + dispatcher. If a route needs data not already projected, that route waits.
- **No complex auth in v0.** API keys only. OAuth/JWT is deferred and requires its own ADR.
- **No raw event emission in v0.** See §4 and §13.

---

## 10. Risks

- **R1 — Drift between CLI and API.** Adding a use case to the CLI but forgetting the API (or vice versa) breaks parity. *Mitigation:* AC-1 + AC-12 (use case registry parity tests) enumerate use cases and fail if either surface lags.
- **R2 — Auth bypass.** A future contributor adds a route without auth middleware. *Mitigation:* Auth middleware is applied at the *router* level (a wrapper around every `/v1/tenants/...` route group), not per route. AC-2 enumerates routes and verifies each is guarded.
- **R3 — Tenant leakage.** The most likely place for tenant isolation to break. *Mitigation:* AC-3 + a dedicated two-tenant isolation test against seeded events.
- **R4 — Idempotency store growth and cross-instance divergence.** The v0 in-process idempotency cache grows unbounded without TTL; cross-instance dedup is not honored. *Mitigation:* TTL-based eviction (24h) within the instance; the AC-9 test documents the v0 caveat; a future spec addresses shared idempotency storage (likely a follow-on once Cloud Run multi-instance becomes a real workload).
- **R5 — Policy denial information leak.** A denial response leaks the policy's internal rules. *Mitigation:* responses carry a stable *code* (`policy_denied`) and a *human message*, not the policy's internal rule bodies. The AC-4 test asserts no rule bodies are leaked.
- **R6 — Health check flapping.** `/readyz` calls the event store; a slow store flaps the readiness signal and triggers Cloud Run restarts. *Mitigation:* timeout on the store check (configurable, default 1s). The signal is binary; transient failures are absorbed.
- **R7 — Cold start on Cloud Run.** First request after idle is slow. *Mitigation:* documented in the spec; the platform's `node --test` baseline gives a comparable lower bound. Optimization (warmup, min-instances) is a Cloud Run config concern, not a code concern.
- **R8 — `registerApi` opt-in confusion.** A module author forgets to call `registerApi` and the module's use cases are unreachable over HTTP. *Mitigation:* AC-12 surfaces the parity test failure; the spec's §5 spells out the hook signature; a short "how to expose a module" doc accompanies the spec.
- **R9 — Canon deviation overreach.** The Platform API expands beyond its named exception. *Mitigation:* §9 (non-goals) and §12 (out of scope) are binding; the parallel ADR records the deviation and the evidence; any expansion beyond the named exception requires its own spec amendment + ADR.

---

## 11. Open questions

- **Q1 — Auth model for v0.** Per-tenant API keys (proposed) vs. mTLS vs. signed JWT. *Recommendation:* API keys for v0 (simple, suitable for programmatic). Migration to OAuth/JWT deferred to v1 / Phase 5 with its own ADR.
- **Q2 — Idempotency store.** In-process (per-instance) vs. file-backed (per-instance) vs. shared (Redis / SQLite). *Recommendation:* in-process for v0 with 24h TTL. Cross-instance dedup is a future concern; AC-9 documents the v0 caveat.
- **Q3 — Use case name → URL slug.** The CLI uses `:` (e.g. `proposal:approve`). The URL uses `/` (e.g. `proposal/approve`). *Recommendation:* use case name is lowercased and `:` becomes `/`. Documented in the spec (§5). Reserved characters in slugs are rejected (`400`).
- **Q4 — OpenAPI generation.** Hand-written vs. generated from a registry. *Recommendation:* hand-written for v0 (small surface), with §4 as the source of truth. A code generator is a v1 concern.
- **Q5 — Module `registerApi` hook.** Each module exposes a function that mounts its routes. *Recommendation:* the hook signature is `registerApi(router, ctx) → void`, where `ctx` provides the event store, the policy engine, the tenant resolver, the idempotency store, and the use case registry. The API iterates over `@daedalus/*` workspace packages and calls `registerApi` on each that exports it. Documented in §5.
- **Q6 — `POST /v1/tenants/:tenantId/events` direct emission.** Reserved for future use. *Recommendation:* **not exposed in v0.** Listed in §4 as reserved, omitted from the OpenAPI document, omitted from the route table. Re-introduced in v1 with explicit ACs and a separate spec amendment.
- **Q7 — CORS.** Server-to-server in v0. *Resolution:* no CORS in v0; v1 introduces a strict allowlist (gated on its own ADR when browser clients land).
- **Q8 — Lineage header defaults.** Always generate fresh if absent (proposed) vs. always require (rejected). *Resolution:* always generate fresh if absent, return in response headers. Documented in AC-10.
- **Q9 — API versioning policy.** URL path `/v1/...` (proposed) vs. header. *Resolution:* URL path. Documented in §7.
- **Q10 — API key provisioning.** Out-of-band env config (proposed for v0) vs. CLI command. *Resolution:* env config in v0 (a single key per tenant, supplied via `DAEDALUS_API_KEY_<TENANT>` env vars, or a JSON file referenced by `DAEDALUS_API_KEYS_FILE`). A `api-key:create` CLI command is a v1 add-on.
- **Q11 — Per-tenant rate limit defaults.** Default of 100 req/s (proposed). *Resolution:* configurable via `API_RATE_LIMIT_PER_TENANT` env var, default 100. Per-instance limit, with the AC caveat.
- **Q12 — Graceful shutdown timeout.** Default 30s (proposed). *Resolution:* configurable via `API_SHUTDOWN_TIMEOUT_MS`, default 30000.

---

## 12. Out of scope (binding)

- Implementation of any code beyond what is described here. Per Constitution Principle 8, no functionality outside an approved spec.
- Any modification to `@daedalus/core` event types, aggregates, or projections.
- Any new policy types (Spec 009 is the canonical policy engine).
- Any UI surface (Atlas is the read UI; Athena — when its spec lands — is the working surface UI).
- Any LLM, external service, or third-party integration.
- Any cross-tenant operation, bulk operation, or streaming/SSE.
- Any CORS, cookies, or browser-specific concerns.
- Any new "Public API" surface beyond the Platform API as defined here. If a future module needs a webhook receiver or a third-party integration, that is a *separate* spec (and a separate ADR if it expands the canon exception).
- Any new design tokens, any coupling to Atlas's visual language. The API has no UI.

---

## 13. Activation criteria

T-01…T-N in `tasks.md` may begin only when **all** of the following hold:

1. **Spec 016 is ratified** by stewards.
2. **An ADR (ADR-009 or equivalent) records the Platform API as a programmatic driving adapter, distinct from the CLI and Atlas, with the conditional retirement of "Public API" from the Avoid-for-now list** — parallel to ADR-005 for ATLAS.
3. **The Policy Engine (Spec 009) can evaluate API requests.** A test asserts that `evaluateAndRecordPolicy` accepts an HTTP-shaped request context (headers, body, principal, tenant) and emits a `PolicyDecisionRecorded` event with the request's lineage. Until this holds, the API is built but `/v1/tenants/.../commands/...` returns `503` per AC-13.
4. **The CLI use case registry is enumerated** (the set of `case "..."` entries in `apps/cli/src/index.ts`) and a parity test baseline exists, so AC-12 has a known shape.
5. **The `registerApi` hook signature is locked in** (Q5 resolution) so modules can opt in without ambiguity.
6. **The first consumer is named.** A concrete first caller (a Cloud Run job, an agent, a CI workflow, an integration) is identified, so the v0 surface has a real demand signal. v0 should not be built speculatively.

---

## 14. Companion artifacts

- **`plan.md`** — implementation plan: file layout (`apps/api/src/` with `server.ts`, `router.ts`, `routes/`, `auth.ts`, `idempotency.ts`, `errors.ts`, `register.ts`), boot sequence, route table, auth flow, idempotency store, OpenAPI hand-write, test layout, evidence run, definition of done.
- **`tasks.md`** — task breakdown T-01…T-N, forward-planning, not a build authorization.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and [Identity](../../docs/identity.md). A driving adapter; nothing more. Admitted as a named exception to the "Public API" item in the Avoid-for-now list, gated on a parallel ADR. Read paths are available from v0; writes are gated on the Policy Engine.*
