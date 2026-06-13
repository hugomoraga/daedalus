# ADR-003 — Adopt a modular monorepo; group the conceptual model under blueprints/

**Status:** Accepted
**Date:** 2026-06-13
**Deciders:** Stewards
**Related:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [Repository Structure](../../docs/repository-structure.md)

---

## Context

After the first build (Proposal Generation v0), the repo root mixed three different kinds of thing: implementation code (`src/`) next to ~8 conceptual placeholder directories (`domains/`, `modules/`, `tenants/`, `events/`, `policies/`, `workflows/`, `agents/`, `knowledge/`), most holding only a README. This created confusion between **canon**, **conceptual model**, **future design**, and **runtime implementation**, and there were two clashing notions of `modules` and `tenants` (conceptual doc vs. code/config).

The Architecture Review and the team's direction call for clearer separation without going to microservices prematurely.

## Decision

Adopt a **modular monorepo** with **npm workspaces**, and group the conceptual directories under **`blueprints/`**. Concretely:

1. **Implementation** lives in:
   - `apps/` — executables / driving adapters. First: `apps/cli`.
   - `packages/` — reusable code: `@daedalus/core`, `@daedalus/proposal-generation`, `@daedalus/jsonl-event-store`.
   - `config/tenants/` — runtime tenant config (no PII).
2. **Conceptual model** moves under `blueprints/` (domains, modules, tenants, events, policies, workflows, agents, knowledge).
3. **Canon & design** stay where they are: `memory/`, `docs/`, `specs/`, `governance/`.
4. **Dependency rule:** `apps → packages`; within a package `adapters → application → domain`. `@daedalus/core` depends on nothing; modules and adapters depend on `core`, never on each other's internals (enforced by package boundaries).
5. **Zero external runtime dependencies:** code runs on Node 22 native type-stripping; `npm install` only symlinks workspace packages; `node_modules/` and `.data/` are gitignored.
6. **No empty packages:** a package is created when it is built. `revenue-visibility` is **not** created until its build.
7. **No microservices** yet. The layout leaves service extraction open (a package becomes a service by adding a transport/app), but extraction happens only with evidence.

## Consequences

**Positive**
- Clear three-zone separation: implementation / conceptual / canon.
- Package boundaries enforce the Core/Module/adapter dependency rule.
- Future service extraction is low-friction; the door is open without paying the cost now.
- Reduced root noise.

**Negative / risks**
- Workspace tooling and cross-package `.ts` imports via `exports` (works on Node 22; the main implementation caveat).
- Over-engineering risk for a small codebase; mitigated by the minimum-packages rule and "no empty packages."

## Scope / acceptance

This was a structural refactor with **no behavior change**. Acceptance held: the 11 acceptance-criteria tests stayed green, the CLI works (`node apps/cli/src/index.ts`), the end-to-end evidence run reproduces, and all doc links were updated. `revenue-visibility` and microservices remain out of scope.

## What this ADR does NOT do

- Does not change the Constitution, the domain model, or any spec's intent.
- Does not select a root entity (see [ADR-001](./ADR-001-defer-root-entity-selection.md)).
- Does not introduce a build step, DI framework, or external dependency.
