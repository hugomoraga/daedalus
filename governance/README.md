# governance/

The cross-cutting governance layer. This is where the organization's decisions about itself are recorded and made auditable.

## Contents

- **`decisions/`** — Architecture Decision Records (ADRs). Every significant architectural choice is recorded here, version-controlled, with context and consequences. Changing the repository's top-level structure requires an ADR.
- **`amendments/`** — Constitutional amendment proposals and history. Changes to [`memory/constitution.md`](../memory/constitution.md) follow the Article VI process and are recorded here as `ConstitutionAmended` events.

## Why governance is auditable by directory

By constitution, *Auditability by Default* (Principle 4) and *Human Governance* (Principle 5) apply to the act of governing itself, not only to business operations. Decisions about the system live in version control so the question "who decided this, when, and why" always has an answer.

*Empty in Phase 0 — the [Constitution](../memory/constitution.md) is the founding act; subsequent decisions accrue here.*
