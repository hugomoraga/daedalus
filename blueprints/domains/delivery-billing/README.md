# Bounded Context: Delivery & Billing

**Purpose:** Executing the engagement and getting paid.

## Domains
- **Project** *(aggregate root)* — the committed engagement, created from an approved Proposal. Lifecycle: created → in delivery → delivered → closed.
- **Invoice** *(aggregate root)* — a demand for payment for delivered work. Lifecycle: issued → sent → paid / overdue / cancelled.
- **Payment** *(aggregate root)* — settlement of an Invoice; closes the value chain. An irreversible financial event — human-governed per Constitution Article V.

See the authoritative definitions in the [Domain Model](../../../docs/domain-model.md). Conceptual only in Phase 0.
