# specs/

**Spec-Driven Development.** Every Daedalus capability begins as a specification here, *before* any implementation.

This is constitutional (Principle 8). A spec is the contract; code is one possible fulfillment of it. Nothing of substance enters `domains/`, `policies/`, `workflows/`, or `agents/` without a corresponding spec in this directory.

## What belongs here
- One spec per capability, named descriptively.
- Each spec states: the problem, the desired behavior, the events involved, the policies that govern it, and the human-governed gates.
- Specs are reviewed against the [Constitution](../memory/constitution.md) before they are accepted.

## What does not belong here
- Implementation, schemas, APIs, UI.

*Empty in Phase 0 by design — the foundational documents in [`docs/`](../docs/) are the first specifications.*
