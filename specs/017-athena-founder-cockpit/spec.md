# Spec 017 — Athena (Founder's Working Surface)

**Status:** Draft
**Type:** Driving adapter — read+write+configure working surface for tenant admins
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* Athena is and *why*, not *how*. Conceptual — no UI markup, no JSON shapes, no handler code. Athena consumes the [Platform API (Spec 016)](../016-platform-api/spec.md) over HTTP; the API is the contract, Athena is a curator on top of it.

> **Canon tension — flagged early.** The [Technical Principles](../../memory/technical-principles.md) §"Avoid for now" list includes **"Web UI"** and **"Public API"**. [ADR-005](../../governance/decisions/ADR-005-atlas-driving-adapter.md) conditionally retired "Web UI" for **Atlas** (a *read-only* UI for operators). [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) conditionally retired "Public API" for the **Platform API** (a *programmatic* surface). **Athena is a third named exception**: a *write-capable, configuration-capable* UI for the founder/admin. This is a more substantial deviation than Atlas (read-only) or the API (no UI) — Athena's writes are governed (Policy Engine, idempotency, lineage, multi-tenant), but the surface is a UI. The spec is conditional on a parallel **ADR-011** (or equivalent) that records the deviation and the evidence (the founder needs a working surface to act on the platform's outputs, and the CLI is the wrong tool for daily/weekly business decisions). Until that ADR is accepted, this spec is **not authorized**.

> **Naming.** The path is `apps/athena/`; the package is `@daedalus/athena`. "Athena" (Ἀθηνᾶ) is the Greek goddess of wisdom and strategy, the counselor of heroes (Odysseus, Perseus). She does not reign nor execute; she *advises*. In the project's naming convention (Daedalus = the artisan, Atlas = mission control, Theia = the broad-sighted Titanide of the repo), Athena is the **advisor to the founder** — the place where decisions are made, configurations are set, and attention is allocated across the multiple roles the founder wears.

---

## 1. Summary

Athena is a **multi-tenant, read+write+configure driving adapter** parallel to `apps/atlas/`. It is the **founder's working surface** — the place where the founder acts on what the platform surfaces, not just observes. Athena is **for tenant admins** (Tenant 0's founder today, future tenants when they onboard). The data Athena reads comes from the same event stream and projections Atlas reads, but through a different lens: **business outcomes, role-aware triage, and decisions that need action**.

Athena consumes the [Platform API (Spec 016)](../016-platform-api/spec.md) over HTTP. Every read is a `GET /v1/tenants/:tenantId/...`; every write is a `POST /v1/tenants/:tenantId/commands/<useCase>` (or a future equivalent). **No business logic lives in Athena.** It is a composition root, parallel to Atlas: routing, presentation, session state, role triage — nothing that mutates domain state outside a use case. The discipline is the same as Atlas: zero external runtime dependencies, design tokens (reused from Atlas — no new design system), hand-authored SVG, multi-tenant by default, paper-and-ink aesthetic.

Athena is built for **delegation**. Today, the founder is the admin, the operator, the developer, and the boss — all in one person. Tomorrow, the founder delegates some of those roles (an employee, an agent, a junior partner). Athena's role-triage shows: *"your attention this week"* → *"your team's attention this week, with you as the escalation point."* The shape of the surface does not change; the actors do.

> **What this is NOT.** Not a BI dashboard. Not a CLI wrapper. Not a Tenant Portal (external users — clients, leads — are a separate, future app). Not an event inspector (Atlas is the read-only observability surface; Athena reads the *aggregated* view, not the raw stream). Not an agent runtime console (Phase 5). Not a Tenant 0 custom app — Athena is generic; Tenant 0 is one config.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Generic Core, Specific Tenants* (Athena is tenant-agnostic, multi-tenant from day one; Tenant 0 is one config); *Auditability by Default* (every write goes through the Platform API → use case → policy → `DomainEvent` with lineage); *Policy before Agent* (Athena's writes are policy-bound by construction, because the API is policy-bound — Athena cannot bypass policy without bypassing the API); *Simplicity First* (no new design system, no UI framework, zero external deps); *Tenant Isolation* (every request is tenant-scoped; the API enforces it). |
| **[Technical Principles](../../memory/technical-principles.md)** | Respects hexagonal layering. Athena is a *driving adapter* on top of another *driving adapter* (the Platform API). It calls the API; the API calls the use cases; the use cases mutate state. The dependency chain is `apps/athena → apps/api → packages/core` (and modules). The "Web UI" item in §"Avoid for now" is **conditionally retired by this spec, gated on ADR-011** (parallel to how ADR-005 retired it for Atlas and ADR-010 retired "Public API" for the Platform API). |
| **[Identity](../../docs/identity.md)** | Athena sits in the **driving adapter** layer, parallel to Atlas, the CLI, and (forthcoming) the Platform API. It is not a Module, not Core, not a Tenant. It does not change the platform/tenant boundary. |
| **[Roadmap](../../docs/roadmap.md)** | Athena is positioned as a **Phase 2/3 capability** that consumes the Platform API. It does not introduce a new phase; it is a horizontal surface that makes existing modules' outputs *actable* for tenant admins. Athena is the **first consumer** of the Platform API (closing Spec 016 §13 #6). |
| **[Event Catalog](../../docs/event-catalog.md)** | Athena reads aggregated views (projections, read models) and writes by dispatching use cases. It does not define new event types. |
| **Spec 007 (Atlas)** | Athena is **peer** to Atlas, not a replacement. Atlas stays *read-only*, *operator-facing*, *technical*. Athena is *read+write+configure*, *founder/admin-facing*, *business*. They may share design tokens (Atlas's `tokens.ts` is the single source of truth — no new design system per [ADR-005 §6](./ADR-005-atlas-driving-adapter.md) and Spec 015). |
| **Spec 012 (Theia)** | Theia is for the *project* (repo). Athena is for the *business* (tenant state). No coupling. |
| **Spec 015 (Spec File Convention)** | Athena's `tasks.md` and `plan.md` follow the canonical format. The linter catches drift. |
| **Spec 016 (Platform API)** | Athena consumes the Platform API. The API's v0 surface is **shaped by Athena's needs** (per [Spec 016 plan §2](../016-platform-api/plan.md) and [ADR-010 §"Companion change"](../../governance/decisions/ADR-010-platform-api-driving-adapter.md)). Athena is the first consumer. The API is the contract; Athena is a curated UI on top. |
| **Spec 009 (Policy Engine)** | Athena's writes pass through `evaluateAndRecordPolicy` (transitively, via the API). The founder cannot bypass policy without bypassing the API — and the API is policy-bound by construction. |
| **Spec 011 (Workflow Engine Projections)** | Athena's "Active processes" view consumes the Spec 011 projections via the API. |
| **Spec 004 (Tax & Compliance Guard)** | Athena's "Compliance" view consumes the Spec 004 read models via the API. |

---

## 3. Goals

1. **Triage by role.** Athena opens on a single view: *"what needs your attention this week, grouped by the role it falls to."* The four founder roles — **admin**, **operator**, **boss**, **developer** — are explicit in the UI. Each item carries a role tag.
2. **Decision inbox.** Proposals, projects, obligations, and configurations that need the founder's sign-off appear in a single inbox. Approve / reject / defer / delegate as one-click actions (each action dispatches a use case via the API).
3. **Configuration surface.** The founder sets up the system in Athena: service catalog, agents (Phase 5), channels, pipelines, jurisdiction profiles. Each configuration is a form-backed write to the API.
4. **Business outcomes.** Beyond decisions, Athena surfaces *opportunities* (ranked), *conversions* (funnel metrics), *agent performance* (Phase 5), and *compliance health* (Spec 004). These are *signals*, not actions.
5. **Built on the Platform API.** Every read and every write goes through the API. Athena contains no use cases, no aggregates, no event handlers, no projections. It is a *client* of the API, not a sibling.
6. **Multi-tenant from day one.** Athena is generic. Tenant 0 is one configuration. Future tenants (e.g. a partner's firm) use the same app with their own tenant profile, modules, and configurations.
7. **Delegation-aware.** When the founder delegates a role (e.g. "operator → agent X" or "admin → junior partner Y"), Athena's role-triage reframes: "your attention" becomes "your team's attention, with the items that escalated to you." The shape does not change; the labels do.
8. **Zero external runtime dependencies.** Node 22 native, vanilla HTML/CSS/JS, no React/Vue/Svelte/jQuery. The same `dependencies: {}` discipline as Atlas and the Platform API.
9. **No business logic.** Composition root only. The temptation to compute "what needs attention" in Athena is real; the discipline says: derive a projection in the Core or a module, expose it via the API, consume it in Athena. Athena renders; it does not decide.
10. **Generic from day one.** This is the constitutional guarantee. Athena is not built for Tenant 0's specific business; it is built for *any* tenant admin's working surface. Tenant 0 is the first config, not the definition.

---

## 4. What Athena reads vs what it does not

### Reads (via Platform API, multi-tenant, no side effects)

| Surface | Source (Spec 016 endpoint) | Purpose |
|---|---|---|
| **Triage panel** | `GET /v1/tenants/:tenantId/projections/triage` (forthcoming) | The opening view. Items grouped by role, with action affordances. |
| **Decisions inbox** | `GET /v1/tenants/:tenantId/commands/pending` (forthcoming — a projection of "events awaiting human action") | Proposals, projects, obligations, configurations waiting for sign-off. |
| **Opportunities** | `GET /v1/tenants/:tenantId/projections/opportunities` (from Spec 003) | Ranked list of qualified opportunities, by stage. |
| **Proposals** | `GET /v1/tenants/:tenantId/projections/proposals` (from Spec 002) | Active proposals, status, last action, value. |
| **Compliance** | `GET /v1/tenants/:tenantId/obligations` (from Spec 004) | Pending, met, missed obligations. |
| **Active processes** | `GET /v1/tenants/:tenantId/workflows/instances` (from Spec 011) | Workflow instances, status, age, who's waiting. |
| **Financials** | `GET /v1/tenants/:tenantId/projections/financial-summary` (from Spec 001) | Expected / confirmed / received, by period. |
| **Activity (recent)** | `GET /v1/tenants/:tenantId/events?type=<...>` | Recent business events filtered to relevant types. |
| **Service catalog** | `GET /v1/tenants/:tenantId/catalog` (forthcoming) | The configured offerings. |
| **Agents** | `GET /v1/tenants/:tenantId/agents` (Phase 5, forthcoming) | Configured agents, status, last run. |
| **Channels** | `GET /v1/tenants/:tenantId/channels` (forthcoming) | Configured channels (Slack, email, etc.). |
| **Pipelines** | `GET /v1/tenants/:tenantId/pipelines` (forthcoming) | Configured data/event pipelines. |

### Writes (via Platform API, governed, multi-tenant, idempotent, policy-bound)

| Action | Source (Spec 016 endpoint) | Effect |
|---|---|---|
| **Approve proposal** | `POST /v1/tenants/:tenantId/commands/proposal/approve` | Emits `ProposalApproved` (from Spec 002). |
| **Reject proposal** | `POST /v1/tenants/:tenantId/commands/proposal/reject` | Emits `ProposalRejected`. |
| **Approve project** | `POST /v1/tenants/:tenantId/commands/project/approve` | Emits `ProjectApproved`. |
| **Close project** | `POST /v1/tenants/:tenantId/commands/project/close` | Emits `ProjectClosed`. |
| **Mark obligation met** | `POST /v1/tenants/:tenantId/commands/obligation/mark-met` | Emits `ObligationMet` (Spec 004). |
| **Upsert catalog item** | `POST /v1/tenants/:tenantId/commands/catalog/upsert` | Emits `CatalogItemUpserted` (forthcoming). |
| **Create agent** | `POST /v1/tenants/:tenantId/commands/agent/create` | Emits `AgentCreated` (Phase 5). |
| **Update agent** | `POST /v1/tenants/:tenantId/commands/agent/update` | Emits `AgentUpdated`. |
| **Add channel** | `POST /v1/tenants/:tenantId/commands/channel/add` | Emits `ChannelAdded`. |
| **Remove channel** | `POST /v1/tenants/:tenantId/commands/channel/remove` | Emits `ChannelRemoved`. |
| **Configure pipeline** | `POST /v1/tenants/:tenantId/commands/pipeline/configure` | Emits `PipelineConfigured`. |

> **No "raw event emission" in v0.** Athena never emits events directly. Every write goes through the API → use case. The Platform API's `POST /v1/tenants/:tenantId/events` is **not exposed** (Spec 016 Q6 resolution), so Athena cannot bypass use cases even if a future contributor tried.

### Does NOT do (binding non-goals)

- Athena does not import from `@daedalus/*` packages *other than* a thin HTTP client for the Platform API. The client lives at `apps/athena/src/api-client.ts` and is the only file that knows the API's URL shape.
- Athena does not compute projections, derive state, or aggregate data. The API's projections are the source of truth.
- Athena does not implement business logic. Every action is a one-click dispatch to a use case.
- Athena does not visualize events at the raw level (no lineage graphs, no SHA-256 replay checks, no per-event inspection). Atlas does that.
- Athena does not serve as a Tenant Portal. External users (clients, leads) interact with the platform via a separate, future app.
- Athena does not implement an agent runtime. Phase 5 (Agent Runtime) is a separate capability; Athena configures agents but does not run them.
- Athena does not introduce a new design system. Atlas's `tokens.ts` is the single source of truth; Athena reuses it (or extends it with Athena-specific tokens, which would then be added to Atlas's file — never duplicated).

---

## 5. Domain concepts

- **Working surface.** A read+write UI for the tenant admin, distinct from an observability surface (Atlas) and a programmatic surface (CLI, API). The working surface is where decisions are made and configurations are set.
- **Role.** One of the founder's four hats: **admin** (catalog, agents, channels, pipelines), **operator** (workflows, system health, processes), **boss** (opportunities, conversions, agent performance), **developer** (technical debt, the system itself). The role is not the actor — it is the *category of attention*. Today, the actor is the founder for all four. Tomorrow, an actor is delegated to a role; Athena re-labels that role's items.
- **Triage item.** A unit of attention: a proposal awaiting approval, a project blocked, an obligation due, a configuration drift, an opportunity to consider. Each carries a `role` tag, an `urgency` (derived from age + impact), and a `next action` (the command to dispatch if the founder acts).
- **Decision.** A write dispatched to a use case via the API. Decisions are not "actions Athena takes" — they are commands the API invokes on Athena's behalf. The audit trail is unchanged.
- **Configuration.** A write that sets up the system (catalog, agent, channel, pipeline). Like decisions, configurations are use case dispatches, not Athena-local mutations.
- **Delegation.** A future capability: assigning a role to a different actor (another human, an agent, a partner). v0 of Athena shows "your attention across all roles" because the founder is the actor for all four. v1 introduces a delegation model: "this role is delegated to actor X; show me only what escalated to me." The shape of the surface does not change; the *filter* does.
- **Tenant config.** The set of modules enabled, the jurisdiction profile, the agent roster, the channel list, the pipeline definitions. Lives in `config/tenants/<tenant>.ts`. Athena renders it; the API stores it.

---

## 6. Events

Athena emits **no events directly**. Every write goes through the Platform API → use case → event. The use cases are the same the CLI calls. The events are the same the Core and modules already define.

For each action dispatched from Athena, the API records:
- The use case's `DomainEvent` (e.g. `ProposalApproved`).
- A `PolicyDecisionRecorded` event (per Spec 009) if the policy engine is invoked.
- All carry full lineage (`eventId`, `tenantId`, `actor`, `causationId`, `correlationId`, `payload`).

Athena does **not** add new event types. This is binding.

---

## 7. Interaction constraints (binding)

- **Multi-tenant by construction.** Every API call carries `tenantId`. Athena never queries across tenants. Switching tenants invalidates cache and reloads data; no cross-tenant state persists.
- **Auth at the API.** Athena's auth is delegated to the Platform API. The session holds an API key (per Spec 016 Q1 resolution); Athena sends `Authorization: Bearer <key>` on every request. The API enforces tenant scoping and policy.
- **Idempotency for writes.** Every write from Athena carries an `Idempotency-Key` (UUID generated client-side per click). Replays return the original result; mismatched payloads return `409` (per Spec 016 AC-5).
- **No business logic in Athena.** All derived state comes from projections. All writes go through use cases. If a panel needs data not exposed by the API, that panel waits — Athena does not invent its own data sources.
- **Zero external runtime dependencies.** `apps/athena/package.json` declares `dependencies: {}`. The HTTP client is `fetch` (Node 22 native). HTML/CSS/JS are hand-authored. No framework, no charts library, no CDN.
- **Tokens reused from Atlas.** The visual language is Atlas's. If Athena needs a new color, spacing, or type token, it is added to `apps/atlas/src/tokens.ts` (the single source of truth per [ADR-005 §6](./ADR-005-atlas-driving-adapter.md)) and imported by both. No duplication.
- **No client-side persistence.** No `localStorage`, no service worker, no IndexedDB. The session is a cookie or a header. State is recomputed from the API on every load.
- **Graceful failure.** If the API is unavailable, Athena renders an explicit "API unreachable" state. No silent failures, no optimistic UI that lies.
- **No streaming / SSE in v0.** Pull-based reads, like Atlas. Real-time push is deferred (when both Atlas and the API support it).
- **No CORS in v0.** Athena runs on the same origin as the API (or the API runs as an internal service). CORS is a v1 concern.

---

## 8. Acceptance criteria

**AC-1 (Reads go through the API).**
- *Given* any panel in Athena,
- *When* the panel renders,
- *Then* the data was fetched via `GET /v1/tenants/:tenantId/...` to the Platform API. No direct read of `@daedalus/*` packages, no direct read of the event store, no direct read of JSONL. A test (`tests/athena-reads-via-api.test.ts`) asserts the network layer (mocked) is the only source.

**AC-2 (Writes go through the API).**
- *Given* any action button in Athena (Approve, Reject, Configure, etc.),
- *When* the founder clicks it,
- *Then* the request is a `POST /v1/tenants/:tenantId/commands/<useCase>` with the correct payload, the `Idempotency-Key` header, and the lineage headers. A test (`tests/athena-writes-via-api.test.ts`) mocks the API and asserts the shape.

**AC-3 (Multi-tenant isolation).**
- *Given* two tenants with overlapping identifiers and seeded events,
- *When* Athena is opened for tenant A,
- *Then* no data from tenant B appears in any panel. A dedicated test (`tests/athena-tenant-isolation.test.ts`) exercises isolation against two seeded tenants.

**AC-4 (Role triage).**
- *Given* a tenant with a mix of items (proposals, projects, obligations, configuration drift),
- *When* Athena's opening triage panel renders,
- *Then* each item carries a `role` tag (admin, operator, boss, developer), and the panel groups items by role. Items without a role tag are rendered under "unclassified" (a warning, not a silent drop). A test asserts the role classification.

**AC-5 (Decision inbox).**
- *Given* the founder opens the Decisions inbox,
- *When* the panel renders,
- *Then* it lists items awaiting sign-off (proposals, projects, obligations pending action), each with one-click Approve / Reject / Defer / Delegate affordances. A click dispatches the corresponding use case via the API (AC-2). The panel updates optimistically; the API's response is the source of truth (a failed dispatch rolls back the UI).

**AC-6 (Configuration surface).**
- *Given* the founder opens the Configuration panel,
- *When* the panel renders,
- *Then* it lists the tenant's catalog, agents, channels, and pipelines. Each item is editable. Edits dispatch `catalog:upsert`, `agent:update`, `channel:add/remove`, `pipeline:configure` via the API. A test asserts the form-to-command mapping.

**AC-7 (Idempotency in the UI).**
- *Given* the founder clicks "Approve" on a proposal,
- *When* the request is in flight and the founder clicks again (double-click, network retry, page reload),
- *Then* the API receives the same `Idempotency-Key` and returns the original result. A second event is not written. A test simulates a double-click and asserts the API is called once with one key.

**AC-8 (Delegation stub, v0).**
- *Given* the founder opens Athena,
- *When* the role-triage panel renders,
- *Then* the panel shows "your attention" (since the founder is the actor for all roles in v0). A "Delegate this role…" affordance is present but greyed out with a tooltip "v1" — the delegation model is not implemented in v0. The affordance is a placeholder, not a silent drop.

**AC-9 (No business logic in Athena).**
- *Given* the Athena codebase,
- *When* a static check runs (grep + AST analysis),
- *Then* no file under `apps/athena/src/` imports from `@daedalus/core`, `@daedalus/*` modules, or any `*.jsonl` event log. Athena imports only the API client, Atlas's `tokens.ts`, and Node 22 native modules. A test (`tests/athena-no-business-logic.test.ts`) enforces this.

**AC-10 (Zero external runtime dependencies).**
- *Given* `apps/athena/package.json`,
- *When* inspected,
- *Then* `dependencies` is `{}`. No React, no Vue, no Svelte, no jQuery, no Tailwind, no CDN. A test (`tests/athena-deps.test.ts`) enforces this.

**AC-11 (Atlas token reuse).**
- *Given* the Athena codebase,
- *When* a token linter runs,
- *Then* no file under `apps/athena/src/` (other than the `tokens.ts` re-export) contains a raw color literal, a font-family outside the trio (`Inter Tight`, `Inter`, `JetBrains Mono`), or a numeric spacing outside the scale `4, 8, 12, 16, 24, 32, 48, 64, 96`. The same rules as Atlas AC-5 apply. A test (`tests/athena-tokens.test.ts`) enforces this.

**AC-12 (Generic from day one).**
- *Given* two tenant profiles (`tenant-0` and a synthetic `tenant-other`),
- *When* Athena is opened for each,
- *Then* the same app renders different content based on the tenant config (modules enabled, jurisdiction, agents, channels, pipelines). Athena contains no `if (tenant === 'tenant-0')` branches. A test seeds two tenants and asserts the same code path renders different content.

---

## 9. Non-goals (binding)

- **Not a BI dashboard.** Athena is a *working surface*, not a metrics explorer. It does not have arbitrary filters, custom queries, or saved views.
- **Not a CLI wrapper.** Athena does not invoke the CLI as a subprocess. It uses the Platform API.
- **Not a Tenant Portal.** External users (clients, leads, partners of a tenant) interact with a separate, future app. Athena is for the *tenant admin* only.
- **Not an event inspector.** Raw event stream, lineage graphs, replay integrity, SHA-256 checks — all in Atlas, none in Athena.
- **Not an agent runtime.** Phase 5 (Agent Runtime) is a separate capability. Athena *configures* agents; it does not *run* them or display their live execution.
- **Not a multi-tenant operations console.** The steward view ("all tenants, all activity") is a future ops surface (e.g. via Theia or a dedicated tool). Athena is scoped to *one* tenant at a time.
- **No new event types, aggregates, projections, or ports in `@daedalus/core` or the modules.** Athena is a pure consumer + dispatcher (via the API).
- **No new design system.** Reuses Atlas's `tokens.ts`. If Athena needs a new token, it is added to Atlas's file — never duplicated.
- **No CORS in v0.** Athena and the API share an origin (or the API is internal).
- **No LLM, no third-party integrations, no CORS, no streaming in v0.** These are v1 concerns.

---

## 10. Risks

- **R1 — "BI dashboard creep."** A future contributor adds charts, custom filters, or saved views. *Mitigation:* §9 (non-goals) is binding; the design tokens keep the aesthetic disciplined; Constitution Principle 9 (Simplicity First) is the cultural guardrail.
- **R2 — Bypassing the API.** A future contributor adds a direct import from `@daedalus/core` to "save a round trip." *Mitigation:* AC-9 (no business logic in Athena) is a static check. The dependency chain `apps/athena → apps/api → packages/core` is structural; Athena *cannot* import Core directly without violating AC-9.
- **R3 — Tenant leakage.** Cross-tenant data leaks through a forged session or a misconfigured API call. *Mitigation:* AC-3 + a dedicated two-tenant isolation test; the API enforces tenant scoping (Spec 016 AC-3).
- **R4 — Idempotency bypass in the UI.** A double-click sends two requests with two different keys; the second one creates a duplicate event. *Mitigation:* AC-7 (idempotency in the UI) generates a stable key per *logical action*, not per click. The platform API's AC-5 catches duplicate keys.
- **R5 — Role misclassification.** An item without a role tag is silently dropped or mis-routed. *Mitigation:* AC-4 renders unclassified items under "unclassified" with a visible warning; the role-triage logic is a pure function tested in isolation.
- **R6 — Token drift.** Athena adds a raw color literal or a font outside the trio. *Mitigation:* AC-11 (token linter) runs in CI, same as Atlas AC-5.
- **R7 — Canon deviation overreach.** Athena expands beyond its named exception (e.g. adds CORS in v0, implements an LLM, becomes a Tenant Portal). *Mitigation:* §9 (non-goals) and §12 (out of scope) are binding; the parallel ADR records the deviation and the evidence; any expansion requires its own spec amendment + ADR.
- **R8 — Dependency on the Platform API.** Athena is a *client* of the API. If the API is not yet built when Athena's build is authorized, Athena is blocked. *Mitigation:* the activation criteria (§13) gate Athena on the API being available; Athena's v0 ships in the same workstream as the API's Phase A (read paths) and Phase B (write paths).
- **R9 — "Tenant 0 custom" creep.** The founder (who is also the spec author and the steward) is tempted to add Tenant 0-specific affordances. *Mitigation:* AC-12 (generic from day one) seeds two tenants; the same code path renders different content. Constitution Principle 10 (Generic Core, Specific Tenants) is the constitutional guardrail; the same applies to *all* driving adapters.

---

## 11. Open questions

- **Q1 — Auth model for Athena.** Does Athena hold a session that proxies the API key, or does the founder enter the API key per session? *Recommendation:* per-session, with the key stored in an HttpOnly cookie. v0 does not implement a real auth UI; the founder enters the key on first load.
- **Q2 — UI rendering style.** SSR with embedded JSON-LD (parallels Atlas) vs. client-side rendering with a thin SSR shell. *Recommendation:* SSR with embedded JSON-LD, identical to Atlas. Same discipline, same token discipline, same static-asset convention.
- **Q3 — Role-triage logic.** Where is the role assigned to an item? Options: (a) the projection itself carries the role tag; (b) Athena classifies on render. *Recommendation:* (a) — projections emit role-tagged items; Athena renders. Keeps Athena free of business logic.
- **Q4 — "Decisions inbox" data shape.** Is it a projection of "events awaiting human action," or a derived view? *Recommendation:* a projection. The Core or the relevant module owns the "pending decisions" view; the API exposes it.
- **Q5 — Configuration forms.** How are complex configurations (e.g. an agent spec) presented? Options: JSON editor, schema-driven form, hand-rolled form per entity. *Recommendation:* schema-driven form (JSON Schema → form). v0 ships with hand-rolled forms for the four entity types (catalog, agent, channel, pipeline); schema-driven is a v1 affordance.
- **Q6 — Service catalog source.** Is the catalog a tenant config (per-tenant) or a Core/Module concept? *Recommendation:* per-tenant config, exposed via the API as a projection. No new Core primitive.
- **Q7 — Phase 5 readiness.** Agents and channels depend on Phase 5 (Agent Runtime). *Recommendation:* Athena's v0 ships with **placeholder panels** for agents, channels, and pipelines. The placeholders show "Phase 5 not yet available" and are absent per AC-6 (sections activate as their backing engines land — Atlas's pattern). The configuration surface for them is also deferred.
- **Q8 — Delegation model.** v0 has no delegation; v1 introduces it. *Recommendation:* define the delegation data model in v0's design (a `roleAssignment` entity — actor + role + scope), but do not implement it in v0. The placeholder affordance in AC-8 is the visible signal.
- **Q9 — "Boss" and "Developer" roles in v0.** The conversation's role taxonomy was admin / operator / boss / developer. v0 may not have all four populated (e.g. "developer" is largely irrelevant until there is technical debt to triage). *Recommendation:* v0 ships with admin, operator, and boss populated from the available projections. "Developer" appears in the role taxonomy with an empty list, signaling that the founder does not currently wear that hat (and delegating it is a v1 concern).
- **Q10 — Acceptance criteria for the "unclassified" warning.** AC-4 mentions unclassified items render with a warning. *Recommendation:* the warning is a small inline label, not a blocking modal. Visible enough to notice; not so loud it disrupts the flow.

---

## 12. Out of scope (binding)

- Implementation of any code beyond what is described here. Per Constitution Principle 8, no functionality outside an approved spec.
- Any modification to `@daedalus/core` event types, aggregates, or projections.
- Any new policy types (Spec 009 is the canonical policy engine).
- Any other UI surface (Atlas is the read UI; Theia is the project UI; Athena is the working surface).
- Any LLM, external service, or third-party integration.
- Any CORS, cookies (beyond a session token for the API key), or browser-specific concerns.
- Any new design system or coupling beyond Atlas's `tokens.ts`.
- Any Tenant Portal, agent runtime console, or multi-tenant operations console. These are separate, future apps.
- Any new "Web UI" surface beyond Athena as defined here. If a future module needs a UI, that is a *separate* spec (and a separate ADR if it expands the canon exception).
- The Phase 5 (Agent Runtime) implementation. Athena *configures* agents; it does not run them. Agent execution is a separate spec.

---

## 13. Activation criteria

T-01…T-N in `tasks.md` may begin only when **all** of the following hold:

1. **Spec 017 is ratified** by stewards.
2. **An ADR (ADR-011 or equivalent) records Athena as a write-capable driving adapter, distinct from Atlas (read-only) and the Platform API (programmatic), with the conditional retirement of "Web UI" from the Avoid-for-now list** — the third named exception, parallel to ADR-005 (Atlas) and ADR-010 (Platform API).
3. **The Platform API (Spec 016) is built and reachable.** Athena's v0 consumes the API; the API must be running. The activation gate is "Phase A (read paths) + Phase B (write paths) of the API are green," not "the API is fully production-hardened."
4. **The use cases Athena needs are exposed via `registerApi`.** Each write command Athena dispatches must be a registered use case in the API. AC-1, AC-2 of the API (parity tests) must be green.
5. **The role-triage logic is defined.** Projections carry role tags (Q3 resolution). The role taxonomy is locked: admin, operator, boss, developer (Q9 resolution).
6. **A first tenant is configured end-to-end.** Tenant 0 (or a synthetic test tenant) has the modules enabled, the agent/channel/pipeline stubs in place, and a seed of events such that every Athena panel has data to render. The "blank tenant" state is rendered explicitly (per Atlas's AC-6 pattern: absent or empty, not aspirational).

---

## 14. Companion artifacts

- **`plan.md`** — implementation plan: file layout (`apps/athena/src/` with `server.ts`, `api-client.ts`, `views/`, `panels/`, `tokens.ts` re-export, `session.ts`), boot sequence, role-triage rendering, decision-inbox flow, configuration forms, test layout, evidence run, definition of done.
- **`tasks.md`** — task breakdown T-01…T-N, forward-planning, not a build authorization.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), and the [Roadmap](../../docs/roadmap.md). A read+write+configure driving adapter; nothing more. Admitted as a third named exception to the "Web UI" item in the Avoid-for-now list (after Atlas for read-only and the Platform API for programmatic), gated on a parallel ADR-011. The first consumer of the Platform API. Built for the founder's working surface; generic from day one; ready for delegation when Phase 5 lands.*
