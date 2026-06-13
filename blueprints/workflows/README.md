# workflows/

Declarative process definitions — how work moves through the value chain.

A workflow describes *what should happen and in what order*, not *how to do each step imperatively*. Workflows react to events and orchestrate the next legitimate transition.

## Position in the hierarchy
- Workflows operate **within Policy** (decision hierarchy, Article III): a workflow cannot authorize what a policy forbids.
- Workflows orchestrate transitions across bounded contexts by reacting to events (see [Event Catalog](../../docs/event-catalog.md)) — contexts do not call each other directly.

## What belongs here
- Versioned, declarative workflow definitions for the value chain (Lead → Payment).
- Compensation / error-correction definitions for unhappy paths (rejection, overdue, cancellation).

*Activated in Phase 2 (Workflow Engine). Empty scaffolding in Phase 0.*
