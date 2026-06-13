# Daedalus Roadmap

**Status:** Foundational · Phase 0
**Version:** 0.2.0
**Last updated:** 2026-06-13

> **Framing.** This roadmap describes *capability maturity*, not a calendar. Committing to dates now would violate *Simplicity First*. Each phase has an **objective**, an **exit criterion**, the **principles it operationalizes**, and the **module milestones** that come online in it.
>
> **Sequencing logic.** Two axes run in parallel:
> 1. **Core capability** follows the constitutional decision hierarchy (Article III): you can't govern agents before policies, can't enforce policies before workflows, can't orchestrate workflows before domains and events exist.
> 2. **Validation** runs through **Tenant 0** (the founder's activity). Every Core capability is proven against real founder pain before it is generalized. Tenant 0 is the test harness, not the destination — the destination (Phase 5) is operating *other* tenants too.
>
> **What we optimize for** stays constant across all phases: freedom, creative focus, traceability, sustainability — **not growth** (see [Identity](./identity.md)).

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
- **Module milestone:** **Revenue Visibility** in its simplest form — a read-only projection over invoice/payment events. (It needs no workflow or policy engine, so it validates the event substrate first and gives the founder value earliest.)

**Exit criterion:** Tenant 0's full value chain (Lead → Payment) can be walked end to end, every step an immutable, tenant-scoped, traceable event — even with transitions still driven manually. Revenue Visibility shows a trustworthy picture from those events.
**Principles operationalized:** Everything is an Event, Auditability by Default, Tenant Isolation, Generic Core / Specific Tenants.

---

## Phase 2 — Workflow Engine
**Objective:** Make process **declarative**. Stop hand-driving transitions; describe the flow and let the engine orchestrate it.

- Workflows describe the value-chain transitions declaratively; the engine reacts to events.
- Compensation / error-correction semantics defined (the deferred `…Cancelled` / `…Reopened` events).
- Workflows are versioned artifacts.
- **Module milestones:** **Opportunity Discovery** and **Proposal Generation** as workflows — capturing/qualifying opportunities and moving them toward proposals, reacting to events without manual shepherding.

**Exit criterion:** Tenant 0's Lead → Payment chain runs as a declared workflow reacting to events, with defined behavior for unhappy paths (rejection, overdue, cancellation).
**Principles operationalized:** Organization as Code, Modular Evolution.

---

## Phase 3 — Policy Engine
**Objective:** Make **Policy before Agent** enforceable. Policies evaluated as decisions, separate from the workflows that act on them.

- Policies are first-class, versioned, testable artifacts; evaluated *before* governed actions.
- Default-deny and escalation-on-ambiguity wired in.
- Human-governed gates (approvals, irreversible actions) enforced by policy, not convention.
- **Module milestone:** **Tax & Compliance Guard** — obligations and deadlines expressed as policy, parameterized by the Tenant 0 profile's jurisdiction. (This module is policy-shaped, so it cannot exist before this phase.)

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
**Principles operationalized:** all ten — the system as a whole.

---

## Dependency Chain (at a glance)

```
Phase 0  Foundations          ── philosophy + identity + model + Tenant 0 profile
   │
Phase 1  Organizational Core  ── generic domains + events + audit log + isolation
   │                              + Tenant 0 instantiated  → Revenue Visibility (v0)
   │
Phase 2  Workflow Engine      ── declarative orchestration
   │                              → Opportunity Discovery, Proposal Generation
   │
Phase 3  Policy Engine        ── enforce Policy-before-Agent + escalation
   │                              → Tax & Compliance Guard
   │
Phase 4  Agent Runtime        ── bounded executors under policy
   │                              → Administrative Shield
   │
Phase 5  Autonomous Ops       ── coordinated autonomy + SECOND tenant on same Core
```

> **Edge cases / risks flagged for human review:**
> - **Module sequencing is a hypothesis.** Revenue Visibility is placed early because it's projection-only; Tax & Compliance Guard late because it's policy-shaped. Confirm this ordering matches the founder's *most urgent* pain — if tax risk is the sharpest pain *today*, the value of a partial Tax Guard earlier may outweigh the clean dependency order.
> - **"Second tenant" in Phase 5 is the real validation of the platform thesis.** Until then, we have a strong single-tenant system that *claims* to be generic. Flagging that genericity is unproven until Phase 5 — and that this is an accepted, deliberate risk.
> - **No dates by design.** Time-bound commitments (if needed for the founder's own planning) live outside this roadmap.
> - **"Autonomous" is bounded.** Phase 5 never removes human accountability (Article V is unamendable). Confirm stakeholders share this definition.

---

*Subordinate to the [Constitution](../memory/constitution.md) and [Identity](./identity.md). Describes capability maturity validated through Tenant 0, not a delivery schedule.*
