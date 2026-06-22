# Daedalus Repository Structure

**Status:** Living document · tracks the actual layout as the system grows.
**Version:** 1.0.0
**Last updated:** 2026-06-22

> **Design intent.** The repository layout *is* part of the architecture. For an Organization-as-Code system, the directory tree is the first place a newcomer reads the organization's shape. After [ADR-003](../governance/decisions/ADR-003-modular-monorepo.md) the repo is a **modular monorepo** that separates three things cleanly: **implementation** (`apps/`, `packages/`, `tools/`), **conceptual model** (`blueprints/`), and **canon/design** (`memory/`, `docs/`, `specs/`, `governance/`).
>
> **Principle applied — Simplicity First.** Packages exist only where a real boundary pays for itself. No empty packages; `revenue-visibility` is created when it is built, not before.

---

## Current layout (as of 2026-06-22)

```
daedalus/
├── README.md                       # Entry point: what this is, how to navigate
│
├── memory/                         # Canon injected into every spec & /plan (Spec Kit)
│   ├── constitution.md             #   supreme governing doc
│   └── technical-principles.md     #   how we build (hexagonal, event-first); binds every /plan
│
├── docs/                           # Human-facing documents
│   ├── manifesto.md                #   what Daedalus is, why it exists
│   ├── identity.md                 #   the platform/tenant boundary; Core vs. Modules vs. Tenants (Canon)
│   ├── domain-model.md             #   domains, bounded contexts, aggregates, modules
│   ├── event-catalog.md            #   the vocabulary of organizational events
│   ├── roadmap.md                  #   capability maturity, validated through Tenant 0
│   ├── repository-structure.md     #   this file
│   ├── agent-orchestration.md      #   multi-agent workflow (worktree-per-session per ADR-008)
│   ├── reviews/                    #   architecture reviews (advisory, historical)
│   └── evidence/                   #   recorded validation runs of built slices
│
├── specs/                          # Spec-Driven Development: spec.md (+ plan.md) per capability
│   ├── 001-revenue-visibility/
│   ├── 002-proposal-generation/
│   ├── 003-opportunity-discovery/
│   ├── 004-tax-compliance-guard/
│   ├── 005-administrative-shield/
│   ├── 006-core-value-chain-completion/
│   ├── 007-atlas-ui/
│   ├── 008-workflow-engine/
│   ├── 009-policy-engine/
│   ├── 010-authoritative-rule-source/
│   ├── 011-workflow-engine-projections/
│   ├── 012-theia/
│   ├── 013-jurisdiction-model/    #   was 008-...; renumbered per ADR-009
│   └── 014-social-to-opportunity-mvp/  # was 009-...; renumbered per ADR-009
│
├── governance/                     # Decisions & amendments
│   ├── decisions/                  #   ADRs (ADR-001 through ADR-008)
│   │   ├── ADR-001-defer-root-entity-selection.md
│   │   ├── ADR-002-adopt-technical-framework.md
│   │   ├── ADR-003-modular-monorepo.md
│   │   ├── ADR-004-export-discipline-and-lineage.md
│   │   ├── ADR-005-atlas-driving-adapter.md
│   │   ├── ADR-006-adopt-workflow-engine.md
│   │   ├── ADR-007-theia-as-tools-directory.md
│   │   └── ADR-008-worktree-per-session.md
│   └── amendments/                 #   constitutional amendments
│
├── apps/                           # Executables / driving adapters (composition roots)
│   ├── cli/                        #   the CLI (@daedalus/cli) — primary operator surface
│   └── atlas/                      #   ATLAS (@daedalus/atlas) — read-only mission-control driving adapter
│
├── packages/                       # Reusable code: core + modules + shared adapters
│   ├── core/                       #   @daedalus/core — generic Core (domain + application + ports)
│   ├── jsonl-event-store/          #   @daedalus/jsonl-event-store — shared infra adapter
│   ├── proposal-generation/        #   @daedalus/proposal-generation — module
│   ├── revenue-visibility/         #   @daedalus/revenue-visibility — module
│   ├── opportunity-discovery/      #   @daedalus/opportunity-discovery — module
│   ├── workflow-engine/            #   @daedalus/workflow-engine — Core capability (Phase 2)
│   └── tax-compliance-guard/       #   @daedalus/tax-compliance-guard — module (Spec 004, Phase 3)
│
├── tools/                          # Development tooling (NOT part of the platform itself)
│   ├── scripts/                    #   bootstrap + maintenance scripts (e.g. new-session.sh per ADR-008)
│   └── theia/                      #   Theia (@daedalus/theia) — read-only repo visualizer (Spec 012)
│
├── config/
│   └── tenants/                    # runtime tenant config (tenant-0.ts, tenant-other.ts) — NO PII
│   └── rulesets/                   # tax & compliance rule sets (per tenant, gitignored or local)
│   └── policies/                   # policy bundles for the Policy Engine
│
├── blueprints/                     # CONCEPTUAL MODEL (not code)
│   ├── README.md
│   ├── modeling-observation-transformations-vs-capabilities.md
│   ├── agents/  domains/  events/  knowledge/  modules/
│   ├── policies/  tenants/  workflows/
│
├── infrastructure/                 # Infrastructure as Code (reproducible, versioned)
│
└── .data/                          # GITIGNORED runtime event logs + work-areas (no PII)
```

---

## The three zones

| Zone | Directories | Holds |
|---|---|---|
| **Implementation** | `apps/`, `packages/`, `tools/`, `config/` | The running system: code, composition roots, runtime config, dev tooling. |
| **Conceptual model** | `blueprints/` | DDD/design artifacts that describe the system but are not code. |
| **Canon & design** | `memory/`, `docs/`, `specs/`, `governance/` | The non-negotiable context, human docs, specs, and decisions. |

## Why each top-level directory exists

| Directory | Maps to | Rationale |
|---|---|---|
| `memory/` | Constitution + Technical Principles | Spec Kit convention — non-negotiable context injected into every spec and `/plan`. |
| `docs/` | Manifesto, Identity, Domain Model, Event Catalog, Roadmap, Agent Orchestration, reviews, evidence | Human-facing foundations, multi-agent workflow, and recorded validation runs. |
| `specs/` | Spec-Driven Development | Every capability begins as `spec.md` (then `plan.md` and `tasks.md`), before code. |
| `governance/` | ADRs + amendments | Decisions are version-controlled and auditable. |
| `apps/` | Driving adapters / executables | `apps/cli` is the primary operator surface; `apps/atlas` is the read-only mission-control driving adapter. Both are composition roots — no business logic in either. |
| `packages/` | Core + modules + shared adapters | Enforced boundaries via workspaces: `@daedalus/core` is the hub; modules and adapters depend on it, never on each other's internals. |
| `tools/` | Development tooling | Software that helps build, inspect, or operate the platform, without being part of it. Per [ADR-007](../governance/decisions/ADR-007-theia-as-tools-directory.md), `tools/` never depends on `@daedalus/*` packages at runtime. |
| `config/tenants/` | Runtime tenant config | Tenant-scoped parameters (currency, enabled modules, rule sets, policies). NO PII. Distinct from the conceptual tenant *profile* in `blueprints/tenants/`. |
| `blueprints/` | Conceptual model | DDD bounded contexts, module catalog, tenant profiles, event/policy/workflow/agent design notes. Not code. |
| `infrastructure/` | Infrastructure as Code | Reproducible, versioned infra. |
| `.data/` | Runtime logs + work-areas | **Gitignored.** Append-only JSONL per tenant. No real data / PII in version control. |

---

## Workspace mechanics

- **npm workspaces**, declared in the root `package.json` (`packages/*`, `apps/*`, `tools/*`). Each package has its own `package.json` with a `@daedalus/*` name and `exports` pointing at its `src/index.ts`.
- **Zero external runtime dependencies.** Code runs on **Node 22 native TypeScript type-stripping** (`node apps/cli/src/index.ts`, `node --test`). `npm install` only symlinks the workspace packages; `node_modules/` is gitignored.
- **Dependency rule:** `apps → packages`, and within packages `adapters → application → domain`. `@daedalus/core` depends on nothing. `tools/*` does NOT depend on `@daedalus/*` (per ADR-007).

## Conventions

- **Specs precede code.** Nothing of substance enters `packages/` or `apps/` without a `spec.md` (and usually `plan.md` + `tasks.md`) in `specs/`.
- **Governance is auditable.** Significant architectural choices are ADRs in `governance/decisions/`. Constitutional changes go through `governance/amendments/`. Currently 8 ADRs ratified.
- **No empty packages.** A package is created when it is built (e.g. `revenue-visibility` arrived with its implementation, not before).
- **The Core stays generic.** New modules are new packages depending on `@daedalus/core`; the Core never depends on a module. Changing the top-level zones requires an ADR.

## Multi-agent workflow (one worktree per session)

Per [ADR-008](../governance/decisions/ADR-008-worktree-per-session.md), every agent session runs in its own `git worktree` bound to one branch. A `git checkout` in one worktree cannot wipe another's working tree. Bootstrap a new session with:

```bash
tools/scripts/new-session.sh <NNN> <slug>      # creates ../daedalus-<slug> on branch NNN-<slug>
cd ../daedalus-<slug>
npm install                                   # workspace symlinks re-resolve
```

Session close (after PR merges): `git worktree remove <path>`. Detailed worked example in [`docs/agent-orchestration.md`](agent-orchestration.md).

---

*Subordinate to the [Constitution](../memory/constitution.md) and [Technical Principles](../memory/technical-principles.md). The layout is architecture; changing the top-level zones requires an ADR ([ADR-003](../governance/decisions/ADR-003-modular-monorepo.md)).*
