# ADR-007 — Add `tools/` top-level directory for Theia (development tool)

**Status:** Proposed
**Date:** 2026-06-23
**Deciders:** Stewards
**Trigger:** [Spec 012 — Theia](../../specs/012-theia/spec.md) Drafted (governance PR for ratification).
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-003](./ADR-003-modular-monorepo.md), [ADR-005](./ADR-005-atlas-driving-adapter.md), [Spec 012](../../specs/012-theia/spec.md)

---

## Context

Daedalus's repo currently has three top-level workspace roots: `apps/` (driving adapters: CLI, ATLAS), `packages/` (the Core + Modules), and `config/` (tenant profiles + rule sets + policies). The Technical Principles describe this layout as the canonical structure.

[Spec 012 — Theia](../../specs/012-theia/spec.md) introduces a **development tool** — a read-only, locally-served visualizer of the project's own state (specs, ADRs, code inventory, test results, diff summary). It is structurally distinct from anything the platform itself does:

- **ATLAS** (Spec 007, ADR-005) is a driving adapter over the platform's event stream and projections. It serves tenants.
- **Theia** (Spec 012) is a tool that reads the repository's structured artifacts. It serves the founder and stewards during development. It never imports from `@daedalus/*` packages (AC-15); it only reads files by path.

The two share **visual language** (Atlas tokens) but share **no code**. Theia is not a driving adapter; it does not consume platform events or projections; it is not part of the runtime architecture.

Today the repo has no `tools/` directory. Spec 012 explicitly creates one. This ADR records the architectural decision to admit a new top-level directory and the boundary it enforces.

---

## Decision

1. **Add `tools/` as a new top-level directory**, peer to `apps/`, `packages/`, and `config/`. Its scope is **development tooling** — software that helps build, inspect, or operate the platform, without being part of the platform itself.

2. **Theia is the first and (for now) only tool.** It lives at `tools/theia/`. It is a `@daedalus/theia` workspace package. It declares **no runtime dependencies** (same discipline as ATLAS — ADR-005 §5). It is **never imported by platform code** — the boundary is structural.

3. **The boundary is binding, not advisory.** AC-15 (Spec 012) requires a static grep test that fails the build if any file in `tools/theia/src/**` (except `views/tokens.ts`, the single allowed re-export from Atlas) contains `from "@daedalus/..."` or `import("@daedalus/...")`. Theia may *read* repo files by path; it may not *import* platform code.

4. **`tools/` is not for platform capabilities.** Modules (`packages/<x>/`) are reusable business capabilities over tenant-scoped data. Tools (`tools/<x>/`) are developer-facing software that observes the repo, the platform, or both. The distinction is **who runs it**: tenants consume modules; the founder + stewards use tools.

5. **Visual reuse is the only coupling.** Theia's views re-export `apps/atlas/src/tokens.ts` for design cohesion. If Atlas adds a token, Theia sees it. The reverse is not true — Atlas never depends on Theia. There is no shared runtime.

6. **Theia does not modify the platform.** It does not edit files, emit events, call use cases, or mutate any persistent state. It is read-only by construction; the server rejects non-GET with 405 (AC-12) and any unknown path with 404.

7. **No new canon modifications.** Theia's introduction does **not** amend the Constitution, Technical Principles, Identity, or Roadmap. Spec 012 explicitly states Theia is **not on the roadmap** — it is tooling, not a capability.

---

## Consequences

**Positive.**
- The founder + stewards get a one-glance view of project state without leaving the terminal.
- The platform stays clean: Theia's HTTP server, parsers, and views are structurally separate from the event-sourced architecture.
- Future developer-facing tools (lint runners, dependency auditors, spec drafters) have a canonical home.

**Negative / accepted.**
- One more top-level directory in the repo. Mitigated by clear scope in `tools/theia/README.md` ("what it is, what it isn't").
- The visual reuse from Atlas introduces a single allowed platform import (`views/tokens.ts` re-export). Mitigated by the AC-15 grep test that pins the exception.
- Theia runs `npm test` at startup. On a slow repo, the Tests panel shows "running…" until completion (AC-8). No mitigation needed beyond async startup.

**Future work.**
- A future Spec (v2 of 012, or a separate spec) may add an LLM-backed "spec drafting assistant" — explicitly out of scope here. If added, it would happen via CLI subprocess, not via platform events.
- Other developer tools (e.g. a rules linter that warns when a RuleSet's provenance is stale) may use the same `tools/` convention.

---

## Activation

This ADR is **proposed** and becomes **accepted** when Spec 012 is **ratified** by stewards. Until then, no file under `tools/theia/` may be committed to `main` (the directory does not exist).

If Spec 012 is **not** ratified, this ADR is **rejected** and the `tools/` directory is not introduced.

---

*Subordinate to the Constitution. Pairs with [ADR-005](./ADR-005-atlas-driving-adapter.md) (which authorizes a read-only driving adapter for tenants) by explicitly *not* being one. Authorizes Spec 012 (Theia) as a structurally separate development tool.*
