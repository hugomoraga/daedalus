# @daedalus/workflow-engine

Declarative process layer for the Daedalus value chain. Subscribes to the event
stream, evaluates workflow artifacts, invokes use cases, enforces human gates,
and emits engine events for observability.

Implements [Spec 008 — Workflow Engine (Phase 2)](../../specs/008-workflow-engine/spec.md).
Adopted by [ADR-006](../../governance/decisions/ADR-006-adopt-workflow-engine.md).

## Layering

- `domain/` — pure types and pure functions (workflows, instances, guards). No I/O.
- `application/` — the engine kernel: ports, deps, use-case registry, transitions.
- `adapters/` — concrete persistence adapters (JSONL). Accessed via the
  `@daedalus/workflow-engine/adapters` subpath (ADR-004).
- `cli.ts` — the engine entry point (`node packages/workflow-engine/src/cli.ts run --tenant tenant-0`).

## Public contract

See `src/index.ts` for the curated named exports. Adapters are exposed via the
`./adapters` subpath; deep imports are blocked by the package's `exports` map.

## Conformance

- Hexagonal: domain depends on nothing; application depends on ports only; adapters
  implement ports.
- Lineage: every event the engine emits carries `correlationId` (the workflow
  instance) and `causationId` (the event that triggered the transition), per
  [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md).
- Zero new Core primitives (Spec 008 AC-10): `@daedalus/core` is unchanged.