# infrastructure/

Infrastructure as Code — reproducible, versioned infrastructure.

This is a binding operational requirement in the [Constitution](../memory/constitution.md): all infrastructure must be reproducible and versioned. It is an operational mandate (governing *how the system is deployed*) rather than one of the nine behavioral principles.

## What belongs here
- Declarative infrastructure definitions.
- Environment configuration, versioned and reproducible.

## Principle applied — Simplicity First
No infrastructure is defined in Phase 0. We provision what the *next* phase requires, when it requires it — never speculatively. The directory exists so that when Phase 1 needs durable, tenant-isolated event storage, its home is already defined.

*Activated as phases require it. Empty scaffolding in Phase 0.*
