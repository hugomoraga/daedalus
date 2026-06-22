# Daedalus Roadmap

**Status:** Foundational · Phase 0
**Version:** 0.3.0
**Last updated:** 2026-06-13

> **Framing.** This roadmap describes *capability maturity*, not a calendar. Committing to dates now would violate *Simplicity First*. Each phase has an **objective**, an **exit criterion**, the **principles it operationalizes**, and the **module milestones** that come online in it.
>
> **Sequencing logic.** Two axes run in parallel:
> 1. **Core capability** follows the constitutional decision hierarchy (Article III): you can't govern agents before policies, can't enforce policies before workflows, can't orchestrate workflows before domains and events exist.
> 2. **Validation** runs through **Tenant 0** (the founder's activity). Every Core capability is proven against real founder pain before it is generalized. Tenant 0 is the test harness, not the destination — the destination (Phase 5) is operating *other* tenants too.
>
> **What we optimize for** stays constant across all phases: freedom, creative focus, traceability, sustainability — **not growth** (see [Identity](./identity.md)).

---

## Module Validation Sequence

Modules are prioritized by **founder value delivered to Tenant 0**, not by architectural completeness. The order below is the sequence in which we build and validate them:

| # | Module | Primary pain (Tenant 0) | Spec | Earliest buildable |
|---|---|---|---|---|
| **1** | **Proposal Generation** | customer acquisition (the controllable, high-frequency, revenue-adjacent half) | [Spec 002](../specs/002-proposal-generation/spec.md) | Phase 1 (v0: structured assembly) |
| **2** | **Revenue Visibility** | accounting / runway / solvency | [Spec 001](../specs/001-revenue-visibility/spec.md) | Phase 1 (projection-only) |
| **3** | **Opportunity Discovery** | customer acquisition (top of funnel) | [Spec 003](../specs/003-opportunity-discovery/spec.md) (Draft; boundary open) | Phase 2 |
| **4** | **Tax & Compliance Guard** | taxes & compliance | [Spec 004](../specs/004-tax-compliance-guard/spec.md) (v1.0 shipped) | ✅ **Built** — Phase 3 capability landed; the Module is a guard, not an engine |
| **5** | **Administrative Shield** | the administrative tail | [Spec 005](../specs/005-administrative-shield/spec.md) (stub; blocked) | Phase 4 (needs agent runtime) |

> **Scope of this sequence (binding clarification).** This is an **incremental validation strategy only**. It does **NOT** redefine Daedalus's mission, and it does **NOT** establish the system's root/fundamental entity. The philosophical question of the fundamental entity is deliberately left open — the team prefers to *learn by building* over continuing to model it now. The Constitution, Domain Model, and Identity are unchanged.
>
> **Priority ≠ phase.** A module's priority is independent of the phase that makes its full capability available. Proposal Generation is priority #1 and ships a useful v0 in Phase 1, but its orchestrated form matures in Phase 2. The phases below are capability-dependency milestones; the table above is the value-driven order.

---

## Phase 0 — Foundations
**Objective:** Establish philosophy, governance, identity, and the conceptual model before any code.

- Manifesto, Constitution, Identity, Domain Model, Event Catalog, Repository Structure.
- **Tenant 0 Profile** authored; founder pain captured; the Core/Module/Tenant separation defined.
- Initial **module set** named and motivated (Opportunity Discovery, Proposal Generation, Revenue Visibility, Tax & Compliance Guard, Administrative Shield) — not yet specified.
- Ubiquitous language agreed; repository scaffolding in place.

**Exit criterion:** Stewards ratify the constitution, identity, and domain model; the Tenant 0 case is described conceptually with its pains mapped to reusable modules and to the value chain.
**Principles operationalized:** Spec-Driven Development, Simplicity First, Organization as Code, Generic Core / Specific Tenants.

---

## Phase 1 — Organizational Core
**Objective:** Make the generic Core domains and events real, tenant-isolated and auditable — and instantiate **Tenant 0** as the first operated tenant.

- Core domains exist as modeled aggregates: Tenant, Customer, Lead, Proposal, Project, Invoice, Payment.
- Events from the catalog are emitted and persisted to an append-only Audit Log.
- Tenant isolation enforced structurally; Tenant 0 exists as a configured tenant.
- State reconstructable from the event stream.
- **Module milestone #1 (priority):** **Proposal Generation v0** — structured assembly of a proposal from a qualified lead (no orchestration yet). It needs only the Core aggregates and event substrate, so it ships early and validates the highest-value pain (customer acquisition) first.
- **Module milestone #2:** **Revenue Visibility v0** — a read-only projection over the value-chain events. Needs no workflow or policy engine; validates the event substrate and gives the founder a runway/margin picture once deals exist.
- **Driving-adapter milestone:** **ATLAS v0** — read-only mission-control driving adapter (per [Spec 007](../specs/007-atlas-ui/spec.md) and [ADR-005](../governance/decisions/ADR-005-atlas-driving-adapter.md)). Renders Core and module projections as a multi-tenant mission-control surface (Welcome, Events, Activity Timeline, Recent Logs, System Health). Zero external runtime dependencies. No writes; writes stay in the CLI. Sections whose backing read-models do not yet exist are **absent**, not empty. Builds on top of milestones #1 and #2 — does not advance the roadmap.

**Exit criterion:** Tenant 0's full value chain (Lead → Payment) can be walked end to end, every step an immutable, tenant-scoped, traceable event — even with transitions still driven manually. Proposal Generation can assemble a real proposal, Revenue Visibility shows a trustworthy picture from those events, and ATLAS renders that picture for the operator without requiring new CLI commands per view.
**Principles operationalized:** Everything is an Event, Auditability by Default, Tenant Isolation, Generic Core / Specific Tenants.

---

## Phase 2 — Workflow Engine
**Objective:** Make process **declarative**. Stop hand-driving transitions; describe the flow and let the engine orchestrate it.

- **Core capability milestone:** **Workflow Engine v0** — declarative orchestration of the value chain. Per [Spec 008](../specs/008-workflow-engine/spec.md) and [ADR-006](../governance/decisions/ADR-006-adopt-workflow-engine.md). Engine lives in `packages/workflow-engine/` (peer to `@daedalus/revenue-visibility`). Workflows are versioned JSON artifacts declared in `blueprints/workflows/`. Engine emits observability events (`WorkflowInstanceStarted`, `WorkflowTransitionFired`, `HumanApprovalRequired`, `HumanApproved`, `HumanRejected`, `WorkflowInstanceCompleted`, `WorkflowInstanceCompensated`) with full lineage. Compensation uses the named `…Cancelled` / `…Rejected` / `…Overdue` events already in the Event Catalog — no new value-chain events. `PolicyDecisionPort` seam wired but no-op in v0 (Phase 3 plugs in). Two new CLI commands (`human:approve`, `human:reject`) are the only paths to clear a human gate.
- Compensation / error-correction semantics defined (the deferred `…Cancelled` / `…Reopened` events).
- Workflows are versioned artifacts.
- **Module milestones:** **Proposal Generation** matures into an orchestrated flow (reacting to events, moving qualified leads toward proposals without manual shepherding); **Opportunity Discovery** (#3) captures and qualifies opportunities so none are dropped.
- **Follow-on (gated on engine shipping):** ATLAS Phase 2 panels — `active-processes`, `queue-status`, `workflow-metrics` — read-only views over the engine's events.

**Exit criterion:** Tenant 0's Lead → Payment chain runs as a declared workflow reacting to events, with defined behavior for unhappy paths (rejection, overdue, cancellation).
**Principles operationalized:** Organization as Code, Modular Evolution.

---

## Phase 3 — Policy Engine
**Objective:** Make **Policy before Agent** enforceable. Policies evaluated as decisions, separate from the workflows that act on them.

- Policies are first-class, versioned, testable artifacts; evaluated *before* governed actions.
- Default-deny and escalation-on-ambiguity wired in.
- Human-governed gates (approvals, irreversible actions) enforced by policy, not convention.
- **Module milestone:** **Tax & Compliance Guard** ✅ **Built (Spec 004 v1.0).** Obligations and deadlines expressed as policy, parameterized by the Tenant 0 profile's jurisdiction. The Module is a **guard, not an engine**: it watches financial events, computes deadlines, and emits the obligation lifecycle (`ObligationDue` / `Met` / `Missed` / `EvaluationRecorded`). No jurisdiction-specific content in the Core. The system **guards**; the human claims compliance (🚩 Compliance Flag).

**Exit criterion:** No governed action in Tenant 0's chain executes without a recorded policy decision; ambiguity reliably escalates to the founder; tax/compliance obligations are flagged before they become problems.
**Principles operationalized:** Policy before Agent, Human Governance, Auditability by Default.

---

## Phase 4 — Agent Runtime
**Objective:** Introduce bounded executors that perform tasks *within* policy and workflow — never defining behavior.

- Agents execute authorized tasks and emit `AgentActionExecuted` with full lineage, or don't run.
- Agents cannot self-modify policy, escalate privileges, or cross tenant scope (Article IV, enforced).
- Humans approve at every gate policy marks as human-governed.
- **Module milestone:** **Administrative Shield** — agents intercept the administrative tail and present it to the founder as decisions, not chores. (This is the module that most directly returns the founder's attention, and it needs the agent runtime to exist.)

**Exit criterion:** For Tenant 0, agents can advance the value chain (e.g. draft a proposal, prepare an invoice) entirely within policy, every action traceable, every irreversible step gated by the founder — and the administrative tail no longer reaches the founder as chores.
**Principles operationalized:** Policy before Agent, Human Governance, Auditability by Default.

---

## Phase 5 — Autonomous Operations (and beyond Tenant 0)
**Objective:** Tenant 0 runs much of its routine value chain autonomously — and the platform proves it can operate a **second** tenant.

- Multiple agents coordinate within governance to operate Tenant 0's value chain.
- The founder focuses on judgment, creativity, architecture, and problem-solving; the system absorbs coordination, administration, and repetitive execution.
- **The platform onboards a second tenant** using the same Core and modules with no Core changes — the real test of Principle 10.
- New bounded contexts/modules (People, Finance, Procurement) added around the stable Core as needed.

**Exit criterion:** Tenant 0's routine Lead → Payment chain operates with minimal founder intervention while human accountability and full auditability are preserved — **and** a second, different tenant is operable on the same Core. The paradigm — *Organization as Code*, as a platform — is validated.

---

## Phase 1+ follow-on — ATLAS v1 (Throughput + Monitoring)

**Objective:** Extend ATLAS with the panels whose backing models only land once Revenue Visibility v1's projections are stable.

- **Throughput** — windowed projection over the event stream (per-tenant time window).
- **Monitoring** — alerts panel (reads Revenue Visibility v1's alerts).
- Performance hardening for tenants with > 10k events: precomputed projections on disk so the 2-second Welcome target holds.

**Exit criterion:** ATLAS renders FinancialSummary + alerts per tenant; AC-7 (performance) holds at 10k events.

**Principles operationalized:** Auditability by Default (operators see alerts without polling), Simplicity First (hand-authored SVG, no charts library).
**Principles operationalized:** all ten — the system as a whole.

---

## Dependency Chain (at a glance)

```
Phase 0  Foundations          ── philosophy + identity + model + Tenant 0 profile
   │
Phase 1  Organizational Core  ── generic domains + events + audit log + isolation
   │                              + Tenant 0 instantiated
   │                              → #1 Proposal Generation (v0), #2 Revenue Visibility (v0)
   │
Phase 2  Workflow Engine      ── declarative orchestration
   │                              → Proposal Generation (orchestrated), #3 Opportunity Discovery
   │
Phase 3  Policy Engine        ── enforce Policy-before-Agent + escalation
   │                              → #4 Tax & Compliance Guard
   │
Phase 4  Agent Runtime        ── bounded executors under policy
   │                              → #5 Administrative Shield
   │
Phase 5  Autonomous Ops       ── coordinated autonomy + SECOND tenant on same Core
```

(Numbers `#1…#5` are the value-driven validation priority from the Module Validation Sequence; phase placement is capability dependency.)

> **Edge cases / risks flagged for human review:**
> - **Module sequencing decision (v0.3.0).** Resolved to order modules by **founder value**, not architectural completeness: Proposal Generation leads because customer acquisition is the existential pain and it ships a useful v0 early; Revenue Visibility follows. This is a validation strategy, not a mission change. Remaining hypothesis: the priority assumes the founder needs pipeline more than runway visibility *today* — revisit if that changes.
> - **"Second tenant" in Phase 5 is the real validation of the platform thesis.** Until then, we have a strong single-tenant system that *claims* to be generic. Flagging that genericity is unproven until Phase 5 — and that this is an accepted, deliberate risk.
> - **No dates by design.** Time-bound commitments (if needed for the founder's own planning) live outside this roadmap.
> - **"Autonomous" is bounded.** Phase 5 never removes human accountability (Article V is unamendable). Confirm stakeholders share this definition.

---

*Subordinate to the [Constitution](../memory/constitution.md) and [Identity](./identity.md). Describes capability maturity validated through Tenant 0, not a delivery schedule.*
