# Daedalus Technical Principles

**Status:** Ratified · **Canon** · binding on all implementation work
**Version:** 1.0.0
**Last updated:** 2026-06-13
**Authority:** Subordinate to the [Constitution](./constitution.md). Where the Constitution governs *how the organization behaves*, this document governs *how we build the system*. Every `/plan` and every implementation decision must conform to it, or record a deviation as an ADR.

> Located in `memory/` (alongside the Constitution) deliberately: per the GitHub Spec Kit convention, `memory/` is the durable context injected into every spec and plan. This framework is meant to be **considered in every future `/plan`**, so it lives where planning context is read.

---

## Why this exists

The early implementations of Daedalus must establish a clean, reusable build pattern *before* the mission or the root entity is settled (see [ADR-001](../governance/decisions/ADR-001-defer-root-entity-selection.md)). If the first vertical slice is clean, we can reuse it for every future module regardless of what Daedalus eventually becomes. This document fixes that pattern.

It **operationalizes** several constitutional principles in code: *Everything is an Event* → Event-First; *Tenant Isolation* → isolation from day one; *Spec-Driven Development* → Spec → Plan → Tasks → Implementation; *Simplicity First* → Infrastructure as Detail and the "avoid for now" list.

---

## Technical Principles

### 1. Spec-Driven Development
All work originates from **Spec → Plan → Tasks → Implementation**. No functionality is introduced outside an approved spec. Code without a spec is not a shortcut; it is untracked scope.

### 2. Clean / Hexagonal Architecture
Explicit separation between **Domain**, **Application**, **Ports**, and **Adapters**. Infrastructure decisions must not contaminate the domain.
> *Critical note:* hexagonal architecture costs boilerplate and indirection. We accept that cost **only** where it buys real swappability (e.g. the Event Store). We do **not** create a port for something that will never have a second implementation. Ports earn their place.

### 3. Event-First Design
Events are first-class citizens. Relevant state changes are expressed as **auditable domain events**. We model **facts of the domain** before reaching for CRUD. State is a projection of events, not the source of truth.

### 4. Tenant Isolation
Tenant isolation exists from the initial design. Although Tenant 0 is the only real tenant today, **the Core must not depend on it**. Tenant identity is a first-class parameter of every event and every store access.

### 5. Infrastructure as Detail
Infrastructure is replaceable. The first implementation may use simple persistence, provided it respects the architectural contracts (ports). Nothing in the domain or application layer may know *how* persistence works.

---

## First-Phase Decisions

### Interface — CLI as the first adapter
The CLI is the first **driving (primary) adapter**. Rationale: simplicity, speed of learning, and avoiding premature UI or API. **The CLI must contain no business logic** — it parses input, builds a Command, invokes a use case, and renders output. Nothing more.

### Persistence — JSONL append-only, one file per tenant
```
.data/
  tenants/
    tenant-0/
      events.jsonl
```
The choice of JSONL is deliberate. We are **not** seeking scalability in this phase. We are seeking **auditability, simplicity, human inspection, and easy experimentation with event sourcing**. (`.data/` is gitignored — no real tenant data in version control.)

### Event Store — a Port with a JSONL adapter
Define an **`EventStorePort`**. The initial implementation is a **`JsonlEventStoreAdapter`**. The domain and use cases must **not** know JSONL exists. Swapping to SQLite or Postgres later must touch only the adapter.

### State reconstruction from events
Even if simple, state must be reconstructable by **replaying events**. This validates the event-first model early — the whole point of the first slice.

---

## Reference Architecture (the canonical layout)

```
src/
  domain/                      # pure: aggregates, value objects, domain events. NO I/O, NO infra.
    core/                      #   Core (tenant-agnostic) domain
    <module>/                  #   module domain (e.g. proposal-generation)
  application/                 # use cases / command handlers, Commands (DTOs), Ports
    ports/
      event-store.ts           #   EventStorePort (interface)
    <module>/
      use-cases/               #   command handlers orchestrating domain + ports
  adapters/
    persistence/
      jsonl-event-store.ts     #   JsonlEventStoreAdapter implements EventStorePort (driven)
    cli/                       #   driving adapter — NO business logic
  config/
    tenants/                   #   tenant config/templates loaded as data (Tenant layer; no PII)
.data/                         # gitignored runtime event logs + work-areas
```

Dependency rule: **dependencies point inward.** `adapters → application → domain`. The domain depends on nothing. The Core / Module / Tenant split from the Constitution is expressed *inside* `domain/` and `application/`; the hexagonal layers are the outer structuring axis.

### The success chain (must work cleanly end to end)
```
Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI
```
If this chain runs cleanly for one vertical slice, it is reusable for every future module — independent of the final mission or root entity.

---

## Patterns

### Keep
- Hexagonal Architecture
- Use Cases / Command Handlers
- Small Aggregates
- Domain Events
- Event Store Port
- Value Objects (where they add clarity)
- DTOs / Commands for inputs

### Avoid for now
- Full CQRS
- Sagas
- Process Managers
- Workflow Engine
- Full Policy Engine
- Distributed Event Bus
- Plugin System
- Dependency Injection framework
- Microservices
- Public API
- Web UI
- Complex auth
- Relational databases

> These are not bad ideas. They are **deferred pending evidence** that justifies their complexity (*Simplicity First*). Introducing any of them requires a spec and, for an architectural shift, an ADR.

---

## Success Criterion

The first vertical slice must demonstrate that Daedalus can execute the success chain above cleanly. Concretely:
- a CLI command produces a Command DTO with no business logic in the CLI,
- a use case loads/saves through the `EventStorePort` only,
- an aggregate emits domain events,
- the `JsonlEventStoreAdapter` appends them to a tenant-scoped JSONL log,
- state is reconstructable by replaying that log,
- two tenants show zero cross-leakage.

---

## How this is applied

- Every `/plan` references this document and shows how its design conforms.
- A deviation from these principles (e.g. adding something from the "avoid" list, or skipping a port) is allowed **only** with an ADR recording the evidence that justifies it.
- This document is itself amendable: as evidence accrues, principles may be revised through the same Spec/ADR process.

---

*Canon. Subordinate to the [Constitution](./constitution.md). Adopted via [ADR-002](../governance/decisions/ADR-002-adopt-technical-framework.md).*
