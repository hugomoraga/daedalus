# Daedalus Repository Structure

**Status:** Foundational · Phase 1
**Version:** 0.3.0
**Last updated:** 2026-06-13

> **Design intent.** The repository layout *is* part of the architecture. For an Organization-as-Code system, the directory tree is the first place a newcomer reads the organization's shape. After [ADR-003](../governance/decisions/ADR-003-modular-monorepo.md) the repo is a **modular monorepo** that separates three things cleanly: **implementation** (`apps/`, `packages/`), **conceptual model** (`blueprints/`), and **canon/design** (`memory/`, `docs/`, `specs/`, `governance/`).
>
> **Principle applied — Simplicity First.** Packages exist only where a real boundary pays for itself. No empty packages; `revenue-visibility` is created when it is built, not before.

---

## Proposed Layout

```
daedalus/
├── README.md                     # Entry point: what this is, how to navigate
│
├── memory/                       # Canon injected into every spec & /plan (Spec Kit)
│   ├── constitution.md           #   supreme governing doc
│   └── technical-principles.md   #   how we build (hexagonal, event-first); binds every /plan
│
├── docs/                         # Human-facing documents
│   ├── manifesto.md  identity.md  domain-model.md  event-catalog.md  roadmap.md
│   ├── repository-structure.md   #   (this file)
│   ├── reviews/                  #   architecture reviews
│   └── evidence/                 #   recorded validation runs of built slices
│
├── specs/                        # Spec-Driven Development: spec.md + plan.md per capability
│   ├── 001-revenue-visibility/
│   └── 002-proposal-generation/
│
├── governance/                   # Decisions & amendments
│   ├── decisions/                #   ADRs (ADR-001, ADR-002, ADR-003, …)
│   └── amendments/               #   constitutional amendments
│
├── apps/                         # Executables / driving adapters
│   └── cli/                      #   the CLI (composition root) — @daedalus/cli
│
├── packages/                     # Reusable code: core + modules + shared adapters
│   ├── core/                     #   @daedalus/core — generic Core (domain + application + ports)
│   ├── proposal-generation/      #   @daedalus/proposal-generation — module (+ its draft adapter)
│   └── jsonl-event-store/        #   @daedalus/jsonl-event-store — shared infra adapter
│
├── config/
│   └── tenants/                  # runtime tenant config (tenant-0.ts) — NO PII
│
├── blueprints/                   # CONCEPTUAL MODEL (not code) — grouped to reduce root noise
│   ├── domains/ modules/ tenants/ events/
│   └── policies/ workflows/ agents/ knowledge/
│
├── infrastructure/               # Infrastructure as Code (reproducible, versioned)
│
└── .data/                        # GITIGNORED runtime event logs + draft work-areas (no PII)
```

---

## The three zones

| Zone | Directories | Holds |
|---|---|---|
| **Implementation** | `apps/`, `packages/`, `config/` | The running system: code, composition roots, runtime config. |
| **Conceptual model** | `blueprints/` | DDD/design artifacts that describe the system but are not code. Grouped so they don't compete visually with implementation. |
| **Canon & design** | `memory/`, `docs/`, `specs/`, `governance/` | The non-negotiable context, human docs, specs, and decisions. |

## Why each top-level directory exists

| Directory | Maps to | Rationale |
|---|---|---|
| `memory/` | Constitution + Technical Principles | Spec Kit convention — non-negotiable context injected into every spec and `/plan`. |
| `docs/` | Manifesto, Identity, Domain Model, Event Catalog, Roadmap, reviews, evidence | Human-facing foundations and recorded validation runs. |
| `specs/` | Spec-Driven Development | Every capability begins as `spec.md`, then `plan.md`, before code. |
| `governance/` | ADRs + amendments | Decisions are version-controlled and auditable. |
| `apps/` | Driving adapters / executables | `apps/cli` is the composition root that wires concrete adapters to ports. Future: more apps (or services) as siblings. |
| `packages/` | Core + modules + shared adapters | Enforced boundaries via workspaces: `@daedalus/core` is the hub; modules and adapters depend on it, never on each other's internals. |
| `config/tenants/` | Runtime tenant config | Tenant-scoped parameters (currency, enabled modules). NO PII. Distinct from the conceptual tenant *profile* in `blueprints/tenants/`. |
| `blueprints/` | Conceptual model | DDD bounded contexts, module catalog, tenant profiles, event/policy/workflow/agent design notes. Not code. `policies/`, `workflows/`, `agents/` will graduate to packages/config when their phases arrive. |
| `infrastructure/` | Infrastructure as Code | Reproducible, versioned infra. |
| `.data/` | Runtime logs + work-areas | **Gitignored.** Append-only JSONL per tenant. No real data / PII in version control. |

---

## Workspace mechanics

- **npm workspaces**, declared in the root `package.json` (`packages/*`, `apps/*`). Each package has its own `package.json` with a `@daedalus/*` name and `exports` pointing at its `src/index.ts`.
- **Zero external runtime dependencies.** Code runs on **Node 22 native TypeScript type-stripping** (`node apps/cli/src/index.ts`, `node --test`). `npm install` only symlinks the workspace packages; `node_modules/` is gitignored.
- **Dependency rule:** `apps → packages`, and within packages `adapters → application → domain`. `@daedalus/core` depends on nothing.

## Conventions

- **Specs precede code.** Nothing of substance enters `packages/` or `apps/` without a `spec.md` (and usually a `plan.md`) in `specs/`.
- **Governance is auditable.** Significant architectural choices are ADRs in `governance/decisions/`. Constitutional changes go through `governance/amendments/`.
- **No empty packages.** A package is created when it is built (e.g. `revenue-visibility` arrives with its implementation, not before).
- **The Core stays generic.** New modules are new packages depending on `@daedalus/core`; the Core never depends on a module. Changing the top-level zones requires an ADR.

> **Edge cases flagged for human review:**
> - **`blueprints/events/` vs. `docs/event-catalog.md`.** The narrative catalog lives in `docs/`; `blueprints/events/` is scaffolded for formal definitions. Confirm the single source of truth before formal event definitions exist.
> - **`blueprints/policies|workflows|agents` will graduate out.** When the Workflow (Phase 2), Policy (Phase 3), and Agent (Phase 4) engines arrive, these stop being conceptual and become packages or runtime config. Their place in `blueprints/` is temporary.

---

*Subordinate to the [Constitution](../memory/constitution.md) and [Technical Principles](../memory/technical-principles.md). The layout is architecture; changing the top-level zones requires an ADR ([ADR-003](../governance/decisions/ADR-003-modular-monorepo.md)).*
