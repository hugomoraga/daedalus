# Daedalus

**An architecture for autonomous organizations governed by policies, workflows, and agents.**

Daedalus is a **platform**, not a company. It lets an organization be modeled, operated, and evolved as a software system — *Organization as Code* — where processes are explicit, policies are first-class, decisions are auditable, and agents execute work under governance while humans stay accountable.

It is designed to operate **many** independent organizations, each as an isolated tenant. Its first tenant is the founder's independent professional activity — **Tenant 0** — the first real validation case, not the definition of the system. **Daedalus is not "Founder OS."**

---

## Thesis

> *Daedalus exists to help builders, architects, and technical founders create and operate independent organizations without being trapped by administrative friction.*

The objective is **not** to maximize growth. It is to maximize **freedom, creative focus, traceability, and economic sustainability** — so the founder spends time on judgment, creativity, architecture, and problem-solving, while workflows, policies, and agents absorb coordination, administration, and repetitive execution.

---

## Start here

Phase 0 — Foundations. No production code, schemas, APIs, or UI by design. Read in this order:

1. **[Manifesto](docs/manifesto.md)** — what Daedalus is, why it exists, what we optimize for.
2. **[Identity](docs/identity.md)** — the platform/tenant boundary; Core vs. Modules vs. Tenants. *Canon.*
3. **[Constitution](memory/constitution.md)** — immutable principles, governance, decision hierarchy, agent limits, human responsibilities. *Supreme governing document.*
4. **[Technical Principles](memory/technical-principles.md)** — how we build: hexagonal architecture, event-first, tenant isolation, CLI + JSONL first. *Canon for implementation; binds every `/plan`.*
5. **[Domain Model](docs/domain-model.md)** — domains, bounded contexts, aggregates, modules, relationships.
6. **[Event Catalog](docs/event-catalog.md)** — the vocabulary of organizational events.
7. **[Roadmap](docs/roadmap.md)** — capability maturity, validated through Tenant 0.
8. **[Repository Structure](docs/repository-structure.md)** — how this repo is organized and why.
9. **[Tenant 0 — Founder Profile](blueprints/tenants/tenant-0-founder-profile.md)** — the first concrete tenant. *Tenant-scoped, not Core.*

---

## The ten constitutional principles

1. **Organization as Code** — every capability is representable as code, config, policy, or workflow.
2. **Policy before Agent** — policies define behavior; agents only execute within them.
3. **Everything is an Event** — state changes are explicit, immutable events.
4. **Auditability by Default** — every significant action is traceable.
5. **Human Governance** — humans hold final authority over irreversible and strategic decisions.
6. **Tenant Isolation** — organizations and workspaces are isolated by design.
7. **Modular Evolution** — the organization evolves through modules around a stable core.
8. **Spec-Driven Development** — every capability begins as a specification.
9. **Simplicity First** — model only what the next stage requires.
10. **Generic Core, Specific Tenants** — the Core is tenant-agnostic; tenant-specific behavior lives in tenant profiles and reusable modules. No single tenant shapes the Core to itself.

*(Infrastructure as Code is a binding operational requirement — see the Constitution.)*

---

## Three-layer architecture

```
CORE     (generic, tenant-agnostic)   → Constitution, domains, events, engines
MODULES  (reusable capabilities)      → born from real pain, designed for any tenant
TENANTS  (specific organizations)     → Tenant 0 = the founder's activity
```

### Initial modules (born from Tenant 0 pain, designed reusable)

| Module | Solves | 
|---|---|
| **Opportunity Discovery** | finding clients |
| **Proposal Generation** | converting interest into offers |
| **Revenue Visibility** | basic accounting / solvency picture |
| **Tax & Compliance Guard** | tax & compliance obligations |
| **Administrative Shield** | the administrative tail |

---

## Initial scope

The Core's first value chain, used by Tenant 0 and reusable by any tenant:

```
Lead → Proposal → Approval → Project → Delivery → Invoice → Payment
```

---

## Method

**Spec-Driven Development** with **GitHub Spec Kit** conventions (constitution at `memory/constitution.md`). Every capability starts as a spec in [`specs/`](specs/). Conceptual model draws on **Domain-Driven Design** and **Event Storming**; governance draws on **Policy-as-Code** practice.

## Driving adapters & dev tools

- **`apps/cli`** — the primary operator surface. State-changing actions live here. Wired as a composition root over the Core and modules.
- **`apps/atlas`** — the read-only mission-control driving adapter. Renders the Core's value chain, the modules' projections, and the workflow engine's read-side surface. Per [Spec 007](../specs/007-atlas-ui/spec.md) and [ADR-005](../governance/decisions/ADR-005-atlas-driving-adapter.md). Zero external runtime dependencies.
- **`tools/theia`** — a development tool. Read-only local visualizer of the repo's own state (specs, ADRs, code inventory, test results). Per [Spec 012](../specs/012-theia/spec.md) and [ADR-007](../governance/decisions/ADR-007-theia-as-tools-directory.md). Never imported by platform code.

## Multi-agent workflow

The repo supports multiple AI-agent sessions working in parallel. Per [ADR-008](../governance/decisions/ADR-008-worktree-per-session.md), every session runs in its own `git worktree` bound to one branch — a `git checkout` in one worktree cannot wipe another's working tree. Bootstrap a new session with [`tools/scripts/new-session.sh`](tools/scripts/new-session.sh). Worked example and conventions in [`docs/agent-orchestration.md`](docs/agent-orchestration.md).

---

*A multi-decade project. The architecture is built to survive being wrong about specifics while staying right about principles.*
