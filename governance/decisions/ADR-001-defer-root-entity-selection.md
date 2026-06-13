# ADR-001 — Defer the selection of a universal root entity

**Status:** Accepted
**Date:** 2026-06-13
**Deciders:** Stewards
**Trigger:** [Architecture Review 001](../../docs/reviews/architecture-review-001.md), finding H2
**Related:** [Domain Model §1](../../docs/domain-model.md), [Identity](../../docs/identity.md), Constitution Principles 9 (*Simplicity First*) & 10 (*Generic Core, Specific Tenants*)

---

## Context

Daedalus is a platform meant to operate many kinds of independent organizations. Its Core currently models a single concrete value chain:

```
Lead → Proposal → Approval → Project → Delivery → Invoice → Payment
```

This chain is coherent and useful for **Tenant 0** (an independent technical founder doing service work). Architecture Review 001 (H2) raised a real risk: the project has **not** chosen a *universal root/fundamental entity*, and continuing to add commercial-specific Core concepts could let one get chosen **implicitly** — quietly narrowing a general platform into a well-governed consulting-company operating system.

Candidate root concepts discussed but not selected: `Lead`, `Opportunity`, `Project`, `Venture`, `Initiative`, `Goal`, `Intention`.

The team has explicitly decided to **learn by building** rather than continue conceptual modeling. Choosing a universal root entity now would be premature abstraction with no usage evidence behind it.

## Decision

1. **We deliberately defer selecting a universal root entity.** No universal "root" concept is declared at this time.
2. **The `Lead → Payment` chain is the first *reference workflow*** used to validate the platform through Tenant 0 — **not** the final ontology of Daedalus and not the lifecycle assumed for every future organization.
3. **No spec may implicitly choose the root entity.** Adding commercial-specific concepts to the *Core* (as opposed to a Module or a Tenant profile) that would effectively fix a universal root requires its own ADR.
4. **Revisit trigger:** reopen this decision only after **Proposal Generation** and **Revenue Visibility** have produced real usage evidence, and ideally after a second, non-consulting tenant has been attempted (the genuine test of Principle 10).

## Consequences

**Positive**
- Honors *Simplicity First*: no abstraction without evidence.
- Protects *Generic Core, Specific Tenants*: the Core does not ossify around one tenant's commercial shape.
- Keeps momentum on implementation rather than further modeling.

**Negative / risks**
- The platform's genericity remains **unproven** until a non-consulting tenant exists; we accept this deliberately.
- Some duplication or refactoring may be needed later when a root entity (if any) is finally chosen. Accepted as cheaper than guessing now.

**Mitigation**
- The guardrail note added to [Domain Model §1](../../docs/domain-model.md) and [Identity](../../docs/identity.md) records, in the canon itself, that the commercial chain is a reference workflow, not the root ontology.

## Scope (what this ADR does NOT do)

- Does **not** change the Constitution, Domain Model structure, Identity, or any spec.
- Does **not** block Proposal Generation v0 or its `/plan`.
- Does **not** select, rename, or rank any candidate root entity.
