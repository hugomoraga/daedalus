# ADR-002 — Adopt the technical framework for early implementations

**Status:** Accepted
**Date:** 2026-06-13
**Deciders:** Stewards
**Related:** [Technical Principles](../../memory/technical-principles.md), [Constitution](../../memory/constitution.md), [ADR-001](./ADR-001-defer-root-entity-selection.md), [Spec 002 plan](../../specs/002-proposal-generation/plan.md)

---

## Context

Daedalus is about to write its first code. The mission and the root entity are deliberately unresolved (ADR-001). We therefore need a clean, reusable **build pattern** that is correct independent of what Daedalus eventually becomes — so the first vertical slice can be reused by every future module.

## Decision

Adopt the framework recorded in [`memory/technical-principles.md`](../../memory/technical-principles.md) as binding canon for all implementation work. In summary:

- **Spec-Driven Development**: Spec → Plan → Tasks → Implementation; no functionality outside an approved spec.
- **Clean / Hexagonal Architecture**: Domain / Application / Ports / Adapters; infrastructure must not contaminate the domain.
- **Event-First Design**: events are first-class; state is a projection of events.
- **Tenant Isolation** from the initial design; the Core never depends on Tenant 0.
- **Infrastructure as Detail**: simple persistence is fine if it respects the contracts.
- First-phase choices: **CLI** (first driving adapter, no business logic), **JSONL append-only per tenant** (`EventStorePort` + `JsonlEventStoreAdapter`), state reconstructable by replay.
- A **Keep / Avoid-for-now** pattern list (full CQRS, sagas, workflow/policy engines, DI frameworks, relational DBs, etc. deferred pending evidence).
- **Success criterion**: the chain `Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI` runs cleanly.

## Consequences

**Positive**
- A reusable, infrastructure-agnostic build pattern decoupled from the unresolved mission/root entity.
- Operationalizes constitutional principles (Everything is an Event, Tenant Isolation, Spec-Driven, Simplicity First) in code.

**Negative / risks**
- Hexagonal boilerplate has a cost; mitigated by the rule that *ports earn their place* (no port without a real second implementation in prospect).
- The "avoid" list may need revisiting sooner than expected; that is allowed via ADR when evidence justifies it.

## Application

- Every `/plan` must show conformance to the framework.
- Deviations require an ADR citing the evidence that justifies the added complexity.
- The first conforming plan is [Spec 002 — Proposal Generation v0](../../specs/002-proposal-generation/plan.md), revised to this framework.
