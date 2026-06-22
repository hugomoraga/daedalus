# ADR-011 — Add Athena as a write-capable driving adapter

**Status:** Proposed
**Date:** 2026-06-22
**Deciders:** Stewards
**Trigger:** [Spec 017 — Athena](../../specs/017-athena-founder-cockpit/spec.md) drafted (v0.2.0 on branch `017-athena-founder-cockpit`); the founder is the admin, operator, developer, and boss simultaneously and needs a working surface to dispatch decisions and configurations at a daily/weekly cadence. The CLI is the wrong tool for this; the platform is moving toward delegation of founder roles.
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-003](./ADR-003-modular-monorepo.md), [ADR-004](./ADR-004-export-discipline-and-lineage.md), [ADR-005](./ADR-005-atlas-driving-adapter.md) (parallels — read-only), [ADR-010](./ADR-010-platform-api-driving-adapter.md) (Athena consumes the Platform API), [Spec 015](../../specs/015-spec-file-convention/spec.md), [Spec 016](../../specs/016-platform-api/spec.md), [Spec 017](../../specs/017-athena-founder-cockpit/spec.md)

---

## Context

Daedalus's organizational Core has, today, three driving surfaces: the CLI (interactive, technical, ad-hoc), Atlas (read-only mission control over the event stream), and the Platform API (programmatic HTTP surface for machines). The CLI is the right tool for plumbing; Atlas is the right tool for operational observability; the API is the right tool for agents, CI, and Cloud Run. None of them is the right tool for the founder's daily working rhythm.

The founder is, today, the **admin** (catalog, agents, channels, pipelines), the **operator** (workflows, system health, processes), the **boss** (opportunities, conversions, agent performance), and the **developer** (the system itself) — all in one person. Each of these roles has a *cadence* (daily triage, weekly configuration, monthly strategy) and a *surface* (decisions, configurations, signals). Today, every one of those activities goes through the CLI, which is a *plumbing* tool. The result is friction: the founder opens a terminal to decide whether to approve a proposal, to set up a service in the catalog, or to add a Slack channel. The attention that should go to the decision is spent on the syntax of the command.

[Spec 017](../../specs/017-athena-founder-cockpit/spec.md) defines **Athena** as a multi-tenant, read+write+configure driving adapter parallel to Atlas. Athena is the founder's **working surface** — the place where the founder opens the laptop, looks at the role-triage panel, makes a decision, configures a system piece, and closes the laptop having moved the organization forward. Athena is a *client* of the Platform API: every read is a `GET /v1/tenants/:tenantId/...`; every write is a `POST /v1/tenants/:tenantId/commands/<useCase>`. Athena contains no business logic.

The Technical Principles §"Avoid for now" list includes **"Web UI"** — already conditionally retired by [ADR-005](./ADR-005-atlas-driving-adapter.md) for **Atlas** (a *read-only* UI for operators). [ADR-010](./ADR-010-platform-api-driving-adapter.md) conditionally retired **"Public API"** for the **Platform API** (a *programmatic* surface). **Athena is a third named exception**: a *write-capable, configuration-capable* UI for the founder/admin. This is a more substantial deviation than Atlas (read-only) or the API (no UI) — Athena's writes are governed (Policy Engine, idempotency, lineage, multi-tenant), but the surface is a UI. The risk profile is different: bypass, leakage, drift, and canon overreach are the canonical failure modes of write-capable UIs, and the spec's ACs (1, 2, 3, 9, 11) explicitly target each.

The platform's near-term roadmap also has *delegation* in view (Phase 5 — Agent Runtime and the future of "your team, not just you"). Athena is the surface that *makes delegation visible*: the same triage panel that today shows "your attention" will, in v1, show "your team's attention, with the items that escalated to you." The shape does not change; the labels do. The capability needs to exist before the delegation feature; the working surface is the foundation.

Without a working surface, the founder's attention is the bottleneck of every decision. The platform exists to absorb friction and return attention; Athena is the surface where that return is realized.

This ADR records the architectural decision: **Athena is admitted as a write-capable driving adapter**, and the "Web UI" item in the Avoid-for-now list is **conditionally retired a second time** — only for Athena as defined in Spec 017, and only when its binding constraints (composition root, client-of-the-API, no business logic, no new Core primitives, multi-tenant, zero deps, design tokens reused from Atlas) hold.

---

## Decision

1. **Add `apps/athena/` as a fourth driving adapter**, peer to `apps/cli/`, `apps/atlas/`, and `apps/api/`. It is a composition root; it contains no business logic. It dispatches user actions to the Platform API; the API dispatches to use cases; the use cases mutate state.

2. **Athena is a client of the Platform API** — by construction, by test, by import boundary. Athena does **not** invoke the CLI as a subprocess, does **not** import from `@daedalus/*` packages, does **not** read the event store directly, does **not** call use cases directly. Every read is a `GET` against the API; every write is a `POST` against the API. Spec 017 AC-9 is a static check that enforces this in CI. The dependency chain is `apps/athena → apps/api → packages/core` (and modules the API serves). Athena *cannot* bypass the API's discipline without violating AC-9.

3. **Conditionally retire the "Web UI" item** in [Technical Principles §"Avoid for now"](../../memory/technical-principles.md) **a second time** — only for Athena as defined in [Spec 017](../../specs/017-athena-founder-cockpit/spec.md). The retirement parallels [ADR-005 §2](./ADR-005-atlas-driving-adapter.md) (which retired "Web UI" for Atlas, read-only) and [ADR-010 §3](./ADR-010-platform-api-driving-adapter.md) (which retired "Public API" for the Platform API). Three named exceptions now exist: Atlas (read-only UI for operators), the Platform API (programmatic surface for machines), Athena (write+configure UI for tenant admins). The general principle against premature UI work stands; each is a named, bounded instance.

4. **Reuse Atlas's `tokens.ts` as the single source of design truth.** No new design system. If Athena needs a new color, spacing, or type token, it is added to `apps/atlas/src/tokens.ts` (per [ADR-005 §6](./ADR-005-atlas-driving-adapter.md)) and imported by both. The token linter (Spec 017 AC-11) enforces it in CI. This is consistent with the pattern established by [ADR-007](./ADR-007-theia-as-tools-directory.md) (Theia reuses Atlas's tokens).

5. **Multi-tenant by construction.** Every Athena request carries a `tenantId` (via the API). Athena never queries across tenants. Tenant switching invalidates the session and reloads data. Tenant 0 is one configuration; future tenants (e.g. a partner's firm) use the same app with their own tenant profile, modules, and configurations. Spec 017 AC-12 (generic from day one) seeds two tenants and asserts the same code path renders different content.

6. **Zero external runtime dependencies.** `apps/athena/package.json` declares `dependencies: {}`. The HTTP client is `fetch` (Node 22 native). HTML/CSS/JS are hand-authored. No framework, no charts library, no CDN. Same discipline as Atlas and the Platform API. The CI-blocking dep linter (Spec 017 AC-10) enforces it.

7. **SSR with embedded JSON-LD**, identical to Atlas. No client-side framework, no hydration. The browser receives a complete HTML document; the JSON-LD is the structured payload for any progressive enhancement. Same token discipline, same static-asset convention, same `assets/fonts/` location if Athena needs a custom font (it does not — it reuses the trio).

8. **Role-triage logic lives in projections, not in Athena.** The Core or the relevant module emits a projection that carries `{ role, urgency, nextAction }` per item. Athena renders the items grouped by role; Athena does *not* classify. Spec 017 Q3 resolution; AC-4 enforces. This keeps Athena free of business logic and makes role assignment a Core/module concern (where it belongs).

9. **v0 ships with three populated roles; "developer" is in the taxonomy with an empty list.** Admin, operator, and boss are populated from the available projections (configurations, workflows, opportunities). "Developer" appears in the role taxonomy as an empty list — a visible signal that the founder does not currently wear that hat. Delegating it is a v1 concern. Spec 017 Q9 resolution; AC-4 enforces.

10. **Delegation: data model in v0, implementation in v1.** A `roleAssignment` entity (actor + role + scope) is documented in Spec 017 as the future shape. v0 ships the AC-8 placeholder affordance ("Delegate this role…" greyed-out with "v1" tooltip) as the visible signal. v1 implements the data model, the role-switching UI, and the re-framed triage ("your team's attention" instead of "your attention"). The shape of Athena does not change between v0 and v1; the *filter* does.

11. **Activation is gated, not speculative.** Per [Spec 017 §13](../../specs/017-athena-founder-cockpit/spec.md), the build begins only when six gates clear: spec ratification, this ADR accepted, **Platform API built and reachable** (Phase A + Phase B of Spec 016 are green), the use cases Athena needs are exposed via `registerApi`, the role-triage logic is defined, and a first tenant is configured end-to-end. v0 does not build speculatively; v0 builds **for the founder's daily use**, on top of the Platform API.

---

## Consequences

**Positive**

- **Founder's attention returned.** Decisions that today require the CLI (Approve proposal, Mark obligation met, Configure channel) become one-click actions. The attention that went to the syntax of the command goes to the substance of the decision. This is the constitutional promise realized.
- **Multi-tenant by construction.** Athena is generic; Tenant 0 is one config. The same app serves future tenants (a partner's firm, a customer's organization) with the same working surface, configured per tenant. The discipline of "Generic Core, Specific Tenants" extends to driving adapters (Constitution Principle 10).
- **Delegation-aware by design.** The role-triage and the placeholder affordance make delegation a first-class concern. When Phase 5 (Agent Runtime) lands, the working surface is ready to absorb the new actors without re-architecting. The future is *additive*; the present is *useful*.
- **Same auditability discipline as the rest of the platform.** Every write flows through the Platform API → use case → policy (Spec 009) → `DomainEvent` with lineage. Athena's audit trail is the same as if the founder had used the CLI. The audit-by-default principle (Constitution Principle 4) holds.
- **Reuse of Canon discipline.** Hexagonal layering, Atlas's tokens, the same SSR pattern, the same zero-deps rule, the same multi-tenant pattern. No new patterns introduced.
- **Idempotency for writes.** The Platform API's `Idempotency-Key` header is generated by Athena per logical action (per click, with a stable key per action, not per request). Replays are safe; the founder can click twice without creating duplicate events. AC-7 enforces.
- **Honest surface.** Placeholder panels for Phase 5 features (agents, channels, pipelines) are *absent* per AC-6 — they do not render aspirational "coming soon" tiles; they do not render at all. The founder sees what is real, not what is planned.
- **Generic from day one.** Two-tenant seeding (AC-12) catches the canonical failure mode of a founder-coded app: Tenant 0 special cases. The same code path renders different content for different tenants.

**Negative / risks**

- **Bypass via direct import.** A future contributor imports from `@daedalus/core` to "save a round trip." *Mitigation:* Spec 017 AC-9 is a static check (`tools/scripts/test-athena-no-business-logic.sh` or equivalent) that fails the build on any such import. The dependency chain is structural: `apps/athena → apps/api → packages/core`. Athena cannot import Core directly without violating AC-9.
- **Tenant leakage.** Cross-tenant data leaks through a forged session, a misconfigured API call, or a shared idempotency key. *Mitigation:* Spec 017 AC-3 + a dedicated two-tenant isolation test; the API enforces tenant scoping (Spec 016 AC-3). Athena is one layer removed from the discipline but inherits it transitively.
- **Idempotency bypass in the UI.** A double-click sends two requests with two different keys; the second creates a duplicate event. *Mitigation:* AC-7 (idempotency in the UI) generates a stable key per *logical action*, not per click. The API's AC-5 catches duplicate keys at the server. The discipline is layered.
- **Role misclassification.** An item without a role tag is silently dropped or mis-routed. *Mitigation:* AC-4 renders unclassified items under "unclassified" with an inline label (Q10 resolution); the role-triage logic is a pure function tested in isolation. The "unclassified" signal is visible, not silent.
- **Token drift.** Athena adds a raw color literal or a font outside the trio. *Mitigation:* AC-11 (token linter) runs in CI, same as Atlas AC-5. The visual discipline is shared, not duplicated.
- **Canon deviation overreach.** Athena expands beyond its named exception (e.g. adds CORS in v0, implements an LLM, becomes a Tenant Portal). *Mitigation:* Spec 017 §9 (non-goals) and §12 (out of scope) are binding; this ADR records the deviation and the evidence; any expansion beyond the named exception requires its own spec amendment + ADR.
- **Dependency on the Platform API.** Athena is a *client* of the API. If the API is not yet built when Athena's build is authorized, Athena is blocked. *Mitigation:* the activation criteria (§13) gate Athena on the API being available. Athena's v0 ships in the same workstream as the API's Phase A (read paths) and Phase B (write paths). The dependency is structural and explicit.
- **"Tenant 0 custom" creep.** The founder (who is also the spec author and the steward) is tempted to add Tenant 0-specific affordances. *Mitigation:* AC-12 (generic from day one) seeds two tenants; the same code path renders different content. Constitution Principle 10 (Generic Core, Specific Tenants) is the constitutional guardrail; the same applies to *all* driving adapters.
- **Permission creep.** A write that should be policy-gated bypasses the gate because the UI doesn't surface the gate. *Mitigation:* Athena's writes go through the API; the API is policy-bound by construction (Spec 016 AC-4). Athena cannot bypass policy without bypassing the API. The discipline is structural.
- **Form-library drift.** v0 ships hand-rolled forms (Q5 resolution). v1 adds a JSON-Schema-driven generator. *Mitigation:* the v1 add-on is a separate spec (and ADR if it expands the canon exception); v0 is honest about its limitations.
- **"Delegation" as a v0 promise that is not a v0 feature.** The placeholder affordance might be mistaken for a working feature. *Mitigation:* the AC-8 tooltip says "v1" explicitly; the affordance is greyed-out; the spec's Q8 resolution is auditable. Honest signaling.

**Cost**

- `apps/athena/` adds a Node 22 SSR process. No new build step, no new infrastructure beyond what the Platform API already requires.
- 12 acceptance-criteria tests added (per Spec 017 §8); existing tests stay green.
- One new package (`@daedalus/athena`) with `dependencies: {}`. npm workspace symlinks resolve without changes.
- One new ADR (this one) and one new spec (017, drafted in v0.2.0).
- One new `docs/evidence/017-athena-founder-cockpit/` run when the build is authorized.
- The activation criteria gate the build on the Platform API being available; Athena does not ship until the API ships (or is shipping in parallel).

---

## What this ADR does NOT do

- Does **not** authorize any new Core event type, aggregate, projection, or port. Athena is a pure consumer (via the API).
- Does **not** authorize direct import from `@daedalus/*` packages. Athena is a *client of the API* (AC-9).
- Does **not** authorize a new design system. Tokens live in `apps/atlas/src/tokens.ts`; Athena re-exports.
- Does **not** authorize a Tenant Portal. External users (clients, leads) interact with a separate, future app.
- Does **not** authorize an event inspector view. Raw events, lineage graphs, replay integrity, SHA-256 checks — all in Atlas, none in Athena.
- Does **not** authorize an agent runtime. Phase 5 (Agent Runtime) is a separate capability; Athena *configures* agents but does not run them. The agents/channels/pipelines panels are placeholders per Spec 017 Q7.
- Does **not** authorize a multi-tenant operations console. The steward view ("all tenants, all activity") is a future ops surface (e.g. via Theia or a dedicated tool).
- Does **not** authorize LLM integration or any third-party service connection in v0.
- Does **not** authorize CORS, cookies (beyond a session token for the API key), or browser-specific concerns in v0.
- Does **not** authorize SSE / WebSocket / webhooks in v0. Pull-based reads, like Atlas.
- Does **not** change the Constitution, the [Identity](../../docs/identity.md) document, the [Domain Model](../../docs/domain-model.md), the [Roadmap](../../docs/roadmap.md), or any ratified spec's intent.
- Does **not** retire "Web UI" from the Avoid-for-now list in general. The list keeps its teeth for any UI work that does not match Athena's constraints. Three named exceptions now exist (Atlas, the API, Athena) — each is a separate, bounded instance.

---

## Acceptance (gate for steward ratification)

This ADR moves Athena into the roadmap only when **all** of the following hold:

1. **[Spec 017](../../specs/017-athena-founder-cockpit/spec.md) is ratified.** *(Pending — currently Draft v0.2.0 on branch `017-athena-founder-cockpit`.)*
2. **The steward ratifies this ADR explicitly.** *(Pending.)*
3. **The activation criteria in Spec 017 §13 are reachable.** That is, the Platform API (Spec 016) is on a path to ship (Phase A + Phase B green), the use cases Athena needs are exposed via `registerApi`, the role-triage logic is defined (Q3 resolution locks it), and a first tenant can be configured end-to-end. *(Pending — activation is not pre-approval of the build; it is a check that the gates are not permanently blocked.)*

Once ratified, the T-01…T-N in `specs/017-athena-founder-cockpit/tasks.md` may begin only when the six gates in Spec 017 §13 clear, in order.

---

## Companion change: Roadmap amendment

This ADR ships together with a minimal amendment to the [Roadmap](../../docs/roadmap.md):

- Athena is positioned as a **Phase 2/3 capability** that **consumes the Platform API**. It is not a new phase; it is a horizontal surface that makes existing modules' outputs *actable* for tenant admins.
- Athena is **the first consumer of the Platform API** (closing Spec 016 §13 #6 — already named on 2026-06-22). The Platform API exists, in part, so that Athena can be built. The two are coupled: the API unlocks Athena; Athena validates the API.
- Athena is **explicitly not on the critical path of Tenant 0's daily operations today** — Tenant 0 uses the CLI. Athena becomes the daily working surface once it ships. The CLI does not disappear; it is the plumbing for one-off and technical operations. Athena is the rhythm for business decisions.
- **Delegation (v1 of Athena)** aligns with Phase 5 (Agent Runtime). The `roleAssignment` data model and the placeholder affordance are v0; the implementation is v1, in the same workstream as the Agent Runtime.

No other sections of the roadmap change. Phase 0, 1, 4, 5 are unaffected (Phase 5 already had Agent Runtime in scope; this ADR just makes Athena its consumer surface).

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Technical Principles](../../memory/technical-principles.md). A third named exception to the "Web UI" item in the Avoid-for-now list (after Atlas for read-only and the Platform API for programmatic) — not a reversal of the principle. A read+write+configure driving adapter; a *client of the Platform API*; nothing more. Built for the founder's working surface; generic from day one; ready for delegation when Phase 5 lands.*
