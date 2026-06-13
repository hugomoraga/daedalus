# Daedalus Repository Structure

**Status:** Foundational · Phase 0
**Version:** 0.2.0
**Last updated:** 2026-06-13

> **Design intent.** The repository layout *is* part of the architecture. For an Organization-as-Code system, the directory tree is the first place a newcomer reads the organization's shape. It must (a) follow the **GitHub Spec Kit** convention so spec-driven workflows work out of the box, and (b) give every constitutional first-class concept — Policy, Workflow, Agent, Event, Domain, Governance — a stable home so it can evolve as a module without disturbing the core.
>
> **Principle applied — Simplicity First.** We scaffold the *shape* now (directories + READMEs explaining intent) but do not fill it with speculative artifacts. A directory with a clear README beats ten empty subfolders guessing at the future.

---

## Proposed Layout

```
daedalus/
├── README.md                     # Entry point: what this is, how to navigate
├── memory/
│   └── constitution.md           # Supreme governing doc (Spec Kit convention)
│
├── docs/                         # Foundational, human-facing documents
│   ├── manifesto.md
│   ├── identity.md               #   platform/tenant boundary — Core vs Modules vs Tenants
│   ├── domain-model.md
│   ├── event-catalog.md
│   ├── roadmap.md
│   └── repository-structure.md   # (this file)
│
├── specs/                        # Spec-Driven Development: one spec per capability
│   └── README.md                 #   every capability begins here, before code
│
├── domains/                      # Bounded contexts — the generic Core (conceptual)
│   ├── README.md
│   ├── tenancy-identity/         #   Tenant, Customer
│   ├── commercial/               #   Lead, Proposal
│   └── delivery-billing/         #   Project, Invoice, Payment
│
├── modules/                      # Reusable capabilities composing the Core
│   └── README.md                 #   born from real pain, designed for any tenant
│
├── tenants/                      # Specific organizations Daedalus operates
│   └── tenant-0-founder-profile.md  # Tenant 0 — the founder's activity (NOT Core)
│
├── governance/                   # The cross-cutting governance layer
│   ├── README.md
│   ├── decisions/                #   Architecture Decision Records (ADRs)
│   └── amendments/               #   Constitutional amendment proposals + history
│
├── policies/                     # First-class policies (Policy before Agent)
│   └── README.md
│
├── workflows/                    # Declarative process definitions
│   └── README.md
│
├── agents/                       # Bounded executors and their definitions
│   └── README.md
│
├── events/                       # Event definitions / catalog source of truth
│   └── README.md
│
├── knowledge/                    # Organizational knowledge base / reference
│   └── README.md
│
└── infrastructure/               # Infrastructure as Code (reproducible, versioned)
    └── README.md
```

---

## Why each top-level directory exists

| Directory | Maps to | Rationale |
|---|---|---|
| `memory/` | Constitution | Spec Kit convention — the non-negotiable context for every spec. Named *memory* because it is what the system must never forget. |
| `docs/` | Manifesto, Identity, Domain Model, Event Catalog, Roadmap | Human-facing foundations. The "why" and "what," separate from machine-consumed artifacts. `identity.md` fixes the platform/tenant boundary. |
| `specs/` | Spec-Driven Development | Every capability begins as a spec here. Enforces the constitutional principle structurally. |
| `domains/` | Bounded contexts & aggregates (generic Core) | One folder per bounded context. New contexts (People, Finance) are added as siblings — *Modular Evolution* made literal. |
| `modules/` | Reusable capabilities | Compositions of Core domains/events/policies that solve a class of pain (Opportunity Discovery, Tax & Compliance Guard, …). Born from a tenant's pain, designed for any tenant — *Generic Core, Specific Tenants* (Principle 10). |
| `tenants/` | Specific organizations | One profile per operated organization. **Tenant 0** is the founder's activity. Quarantines everything tenant-specific so it never leaks into the Core. |
| `governance/` | Decision hierarchy, amendments | ADRs and constitutional amendments live here, version-controlled. Makes governance auditable. |
| `policies/` | Policy domain | Policies as first-class, versioned artifacts — the source of organizational behavior. |
| `workflows/` | Workflow domain | Declarative process definitions, separate from the policies that bind them and the agents that execute them. |
| `agents/` | Agent domain | Agent definitions and their bounded capabilities. Kept distinct so "agents don't define behavior" is visible in the layout. |
| `events/` | Event Catalog (canonical) | The vocabulary of state changes. Separated from `docs/` because events are machine-relevant artifacts, not just prose. |
| `knowledge/` | Knowledge base | Reference material the organization relies on. The substrate for future knowledge-driven capabilities. |
| `infrastructure/` | Infrastructure as Code | Reproducible, versioned infra. Required by the constitution's IaC mandate. |

---

## Conventions

- **Specs precede code.** Nothing of substance enters `domains/`, `policies/`, `workflows/`, or `agents/` without a corresponding spec in `specs/`.
- **Governance is auditable.** Significant architectural choices are recorded as ADRs in `governance/decisions/`. Constitutional changes go through `governance/amendments/` and the Article VI process.
- **The core stays small.** New capabilities are added as modules (new folders under `domains/`, new files under `policies/` etc.), never by reshaping the top level. If the top level needs to change, that is itself an architectural decision requiring an ADR.
- **READMEs carry intent.** Every directory explains *why it exists and what belongs in it*, so the repository is self-documenting for a multi-decade lifespan and a rotating set of stewards.

> **Edge case flagged for human review:**
> - **`events/` vs. `docs/event-catalog.md` — single source of truth.** Right now the catalog lives in `docs/` (human-facing) and `events/` is scaffolded for machine-relevant event definitions. Before Phase 1, confirm which becomes canonical to avoid two drifting copies. Recommendation: `docs/event-catalog.md` stays the narrative/rationale; `events/` holds the formal definitions once they exist — with the catalog linking to them.

---

*Subordinate to the [Constitution](../memory/constitution.md). The layout is architecture; changing the top level requires an ADR.*
