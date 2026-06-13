# Daedalus Domain Model

**Status:** Foundational · Phase 0 (conceptual only — no implementation)
**Version:** 0.2.0
**Last updated:** 2026-06-13

> **Methodology.** This model applies **Domain-Driven Design** (Eric Evans, *Domain-Driven Design*, 2003) and **Event Storming** (Alberto Brandolini, 2013) to discover bounded contexts, aggregates, and the events that connect them. DDD gives a shared vocabulary and a principled way to draw boundaries; Event Storming fits because Daedalus is event-first by constitution (*Everything is an Event*), and events are the natural seam between contexts.
>
> **Critical caveat.** DDD's risk is over-engineering — inventing aggregates and contexts before the domain justifies them. We counterweight with *Simplicity First*: the boundaries below are the **minimum** needed to express the initial value chain for the first tenant. Guesses are marked as **future extension points**, not baked into the Core.

This document is conceptual. It defines *what exists* and *how things relate* in the **generic Core**, plus how **modules** and **tenants** compose on top of it. Per project constraints: **no schemas, no APIs, no code.**

---

## 0. Core, Modules, Tenants (the composition model)

Daedalus is a platform. The domain model has three layers (see [Identity](./identity.md)):

```
CORE (generic, tenant-agnostic)
  ├─ bounded contexts + aggregates  (this document, §2–§3)
  ├─ event vocabulary               (event-catalog.md)
  └─ policy / workflow / agent engines (governance, cross-cutting)
        ▲ composed into
MODULES (reusable capabilities, born from real pain)
  Opportunity Discovery · Proposal Generation · Revenue Visibility
  Tax & Compliance Guard · Administrative Shield
        ▲ selected & configured by
TENANTS (specific organizations)
  Tenant 0 = the founder's activity  (blueprints/tenants/tenant-0-founder-profile.md)
```

- The **Core** domains below are tenant-agnostic. They describe any organization Daedalus operates.
- **Modules** compose Core domains, events, policies, and workflows into a reusable capability. A module may be *born* from one tenant's pain but is *designed* for any tenant with that pain (Constitution, Principle 10).
- **Tenants** select modules and supply a profile. **Tenant 0** is the first; it does not appear in the Core.

---

## 1. The Initial Value Chain

The Core's first value chain — used by Tenant 0 and reusable by any tenant:

```
Lead → Proposal → Approval → Project → Delivery → Invoice → Payment
```

Everything modeled here exists to support *this* chain. It is generic: a "Lead" means the same thing for any tenant. Tenant 0's specifics (who its clients are, its jurisdiction) live in its [profile](../blueprints/tenants/tenant-0-founder-profile.md), not here.

> **Guardrail — reference workflow, not universal ontology.** The `Lead → Payment` chain is the **first reference workflow** used to validate the platform through Tenant 0. It is **not** assumed to be the universal lifecycle of every organization Daedalus may operate (a product venture, an NGO, a studio, a research project may have entirely different chains). The choice of a universal root entity is deliberately deferred — see [ADR-001](../governance/decisions/ADR-001-defer-root-entity-selection.md). Future specs must not implicitly turn this commercial chain into the system's root ontology by adding commercial-specific Core concepts without an ADR.

---

## 2. Bounded Contexts

Three Core contexts cover the initial chain, plus a cross-cutting governance context.

```
┌─────────────────────────────────────────────────────────────┐
│                    GOVERNANCE CONTEXT                         │
│        Policy · Workflow · Agent · Audit Log                  │
│   (cross-cutting — governs and observes all other contexts)   │
└─────────────────────────────────────────────────────────────┘
        │ governs                │ governs               │ governs
        ▼                        ▼                       ▼
┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐
│  TENANCY &       │   │  COMMERCIAL        │   │  DELIVERY &       │
│  IDENTITY        │   │  CONTEXT           │   │  BILLING          │
│                  │   │                    │   │                   │
│  Tenant          │   │  Lead              │   │  Project          │
│  Customer        │   │  Proposal          │   │  Invoice          │
│                  │   │                    │   │  Payment          │
└──────────────────┘   └────────────────────┘   └──────────────────┘
```

| Bounded Context | Purpose | Domains |
|---|---|---|
| **Tenancy & Identity** | Which organization the platform is operating *as* and *for*. Enforces isolation. | Tenant, Customer |
| **Commercial** | Turning interest into a committed engagement. | Lead, Proposal |
| **Delivery & Billing** | Executing the engagement and getting paid. | Project, Invoice, Payment |
| **Governance** | Cross-cutting. Defines rules, orchestrates flow, executes within bounds, records everything. | Policy, Workflow, Agent, Audit Log |

**Why Governance is cross-cutting:** Policy and Workflow *bind* the other contexts (Constitution Article III). They sit above and observe, which is what makes "Policy before Agent" structural rather than optional.

---

## 3. Domain Definitions

Each domain is conceptual: its responsibility, whether it is an **aggregate root** (a consistency boundary with its own lifecycle), and its key relationships.

### Tenancy & Identity

#### Tenant `(aggregate root)`
The top-level isolation boundary and the unit the **platform** operates. Every other entity belongs to exactly one tenant. A Tenant is an organization operating *inside* Daedalus.
- **Owns:** all data scoped beneath it.
- **Configured by:** a tenant profile (which modules, which parameters). **Tenant 0** is the founder's activity; its profile is [here](../blueprints/tenants/tenant-0-founder-profile.md).
- **Invariant:** no entity may reference data across tenant boundaries; no tenant's specifics may leak into the Core.

#### Customer `(aggregate root)`
An external party a tenant does business with. Distinct from Tenant: a Tenant is *the organization Daedalus operates*; a Customer is *who that organization serves*.
- **Belongs to:** one Tenant.
- **Related to:** Leads, Projects, Invoices.

### Commercial

#### Lead `(aggregate root)`
A potential engagement — interest not yet committed. Entry point of the value chain. Populated by the **Opportunity Discovery** module.
- **Belongs to:** one Tenant; references one (prospective) Customer.
- **Lifecycle:** created → qualified → converted to Proposal (or discarded).

#### Proposal `(aggregate root)`
A formal offer derived from a qualified Lead. Produced with help from the **Proposal Generation** module; subject to approval before becoming a Project.
- **Derived from:** one Lead.
- **Lifecycle:** generated → submitted → approved / rejected.
- **Gate:** approval is a governed decision (policy decides whether a human is required — Constitution Article V).

### Delivery & Billing

#### Project `(aggregate root)`
The committed engagement, created when a Proposal is approved.
- **Created from:** one approved Proposal.
- **Related to:** one Customer; produces Invoices.
- **Lifecycle:** created → in delivery → delivered → closed.

#### Invoice `(aggregate root)`
A demand for payment for delivered work. Surfaced to the founder through **Revenue Visibility**; obligations around it watched by **Tax & Compliance Guard**.
- **Issued for:** a Project (or a milestone).
- **Lifecycle:** issued → sent → paid / overdue / cancelled.

#### Payment `(aggregate root)`
Settlement of an Invoice; closes the value chain.
- **Settles:** one Invoice (or part of one).
- **Note:** an **irreversible financial event** — human-governed per Constitution Article V.

### Governance (cross-cutting)

#### Policy
A first-class rule binding organizational behavior, evaluated before action. **Core Policy is tenant-agnostic**; a tenant profile may tighten within it, never override it.
- **Governs:** every other domain.
- **Authority:** subordinate only to the Constitution (Article III).
- **Design lineage:** modeled on **Policy-as-Code** (e.g. Open Policy Agent / Rego) — versioned, testable, decision separated from enforcement.

#### Workflow
A declarative description of how work moves through the value chain.
- **Operates within:** Policy.
- **Orchestrates:** transitions across Commercial and Delivery & Billing by reacting to events.

#### Agent
A bounded executor performing tasks within policy and workflow boundaries. No inherent authority (Constitution Article IV).
- **Constrained by:** Policy (always) and Workflow (when acting within one).
- **Produces:** events for everything it does.

#### Audit Log
The immutable, append-only record of significant events — the system's memory and the substrate of auditability.
- **Records:** every significant action across all contexts and tenants.
- **Invariant:** append-only; entries never mutated or deleted.

---

## 4. Modules (composition layer)

Modules are **not** new bounded contexts; they are reusable compositions of Core domains, events, policies, and workflows that solve a class of pain. They are listed here so the model shows where they attach, but each will get its own spec.

| Module | Composes / touches | Born from (Tenant 0 pain) |
|---|---|---|
| **Opportunity Discovery** | feeds `Lead` (Commercial) | finding clients |
| **Proposal Generation** | feeds `Proposal` (Commercial) | finding clients |
| **Revenue Visibility** | projection over `Invoice` + `Payment` events | basic accounting |
| **Tax & Compliance Guard** | watches obligations around `Invoice` / `Payment`; tenant-parameterized | tax & compliance |
| **Administrative Shield** | intercepts administrative tasks across the whole chain | the administrative tail |

> **Constitutional constraint.** A module must serve any tenant with the relevant pain. Tenant-specific parameters (e.g. tax jurisdiction) are supplied by the tenant profile, never hard-coded into the module (Principle 10).

---

## 5. Relationships Overview

```
Platform 1───* Tenant           (Daedalus operates many tenants; Tenant 0 is the first)
Tenant   1───* Customer
Tenant   1───* { Lead, Proposal, Project, Invoice, Payment }   (everything is tenant-scoped)
Tenant   1───1 Tenant Profile   (selects modules + parameters; e.g. Tenant 0 profile)

Customer 1───* Lead
Lead     1───1 Proposal         (a qualified Lead yields a Proposal)
Proposal 1───1 Project          (an approved Proposal yields a Project)
Project  1───* Invoice          (a Project may bill in milestones)
Invoice  1───1 Payment          (an Invoice is settled by a Payment)

Policy   *───* { all domains }  (Core Policy binds behavior; tenant profiles tighten within it)
Workflow *───* { transitions }  (workflows orchestrate transitions, within policy)
Agent    *───* { tasks }        (agents execute, within policy and workflow)
Module   *───* { Core domains } (modules compose Core capabilities; tenants select modules)
AuditLog 1───* Event            (the log records every significant event)
```

Cardinalities marked `1───1` are the **initial simplification** and will likely relax later — intentionally constrained now per *Simplicity First* (see extension points).

---

## 6. Events as the Connective Tissue

By constitution, *Everything is an Event*. Contexts and modules do not call each other directly; they **react to events**. A Proposal being approved emits `ProposalApproved`; the Delivery context reacts by creating a Project; the Revenue Visibility module updates its projection. This keeps contexts decoupled and the whole chain auditable. Full vocabulary: the [Event Catalog](./event-catalog.md). The domain model defines the *nouns* (aggregates); the catalog defines the *verbs* (events).

---

## 7. Future Extension Points

Marked explicitly so the Core stays simple and evolves without redesign (*Modular Evolution*). **None are in scope for Phase 0–1.**

- **Platform** → multiple live tenants beyond Tenant 0; tenant onboarding.
- **Tenant** → organization hierarchy, workspaces; tenants that are studios/collectives, not solo founders.
- **Customer** → contacts, accounts vs. individuals, relationship history.
- **Lead** → multiple sources, scoring, pipelines (Opportunity Discovery deepens here).
- **Proposal** → versioning, negotiation, line items, pricing (Proposal Generation deepens here).
- **Project** → tasks, milestones, multiple proposals → one project.
- **Invoice** → partial billing, credit notes, tax/multi-currency.
- **Payment** → partial payments, one payment settling many invoices, reconciliation, refunds.
- **Policy** → composition, conflict resolution, simulation/dry-run.
- **Workflow** → sub-workflows, compensation/rollback, long-running sagas.
- **Agent** → capability catalog, multi-agent coordination.
- **Modules** → new modules for new pains; a module catalog tenants browse and adopt.
- **New bounded contexts** → People, Finance/Accounting, Procurement — added as modules/contexts around the stable Core.

> **Edge cases flagged for human review** (Daedalus self-audit, Process Gate):
> - **Modules vs. bounded contexts.** Several modules (Revenue Visibility, Tax & Compliance Guard) touch finance/accounting concerns that *might* deserve their own bounded context rather than being projections/watchers over Billing. Confirm whether a **Finance & Compliance** context is needed in the Core now, or whether keeping them as modules over Delivery & Billing holds for the first iteration. *(This is the most consequential modeling decision of the refactor.)*
> - **Lead → Proposal as 1:1.** Real sales motions generate multiple proposals per lead. Confirm 1:1 is acceptable for the first iteration.
> - **"Delivery" has no aggregate** — modeled as a state of Project (`delivered`). Confirm, or give Delivery first-class modeling for milestone-based delivery/billing.
> - **Administrative Shield is cross-cutting and vague.** It "intercepts admin across the whole chain," which resembles a governance concern more than a domain module. Confirm it is a module, or whether it belongs to the Governance context.

---

*Subordinate to the [Constitution](../memory/constitution.md) and [Identity](./identity.md). Conceptual only — no implementation in this phase.*
