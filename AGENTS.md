# AGENTS.md — Working agreement for any agent on Daedalus

Vendor-neutral instructions for **any** contributor (humans, Claude Code, opencode, ChatGPT, …).
This file does **not** duplicate the canon — it points to it and fixes the working protocol.
If anything here conflicts with the canon below, the canon wins.

## Read first (the canon — source of truth)

These files are **not** auto-loaded every turn (to keep fixed context small).
Load them **on demand** with `@<path>` when the task requires it:

1. `@memory/constitution.md` — supreme governing doc (10 principles, decision hierarchy). **Load when:** writing/reviewing a spec, ADR, or anything that touches governance, tenants, or agent authority.
2. `@memory/technical-principles.md` — how we build (hexagonal, event-first, export discipline). **Binds every plan.** **Load when:** designing a module, writing a `plan.md`, or proposing a structural change.
3. [`docs/identity.md`](docs/identity.md) — platform/tenant boundary (Core vs Modules vs Tenants). **Load when:** placement of new code is ambiguous.
4. [`docs/repository-structure.md`](docs/repository-structure.md) — the modular-monorepo layout. **Load when:** creating packages, moving code, or wiring adapters.
5. [`governance/decisions/`](governance/decisions/) — ADRs (the accumulated architectural decisions). Read them before proposing structural changes.
6. [`specs/`](specs/) — one `spec.md` (+ `plan.md`) per capability. **Load when:** the work belongs to an existing spec.

Decisions live in the repo, not in any agent's chat memory. Agents coordinate **through artifacts** (commits, PRs, ADRs, `docs/reviews/`), not by talking to each other.

## Off-limits (do not read unless the task is *about* that area)

These directories are listed in `opencode.json` `watcher.ignore` and exist for humans / future work, not for current agent turns. Reading them bloats context with no current value:

- `docs/reviews/` — architecture reviews (advisory, historical)
- `blueprints/{agents,domains,events,knowledge,modules,policies}/` — conceptual blueprints, mostly stubs
- `infrastructure/` — placeholder

If a task legitimately needs one of these (e.g. "triage the open architecture review"), load only the specific file via `@<path>`.

## How we work (non-negotiable)

- **Spec-Driven:** Spec → Plan → Tasks → Implementation. No functionality without an approved spec.
- **Clean / Hexagonal:** domain ← application ← adapters; the domain depends on nothing.
- **Event-first:** state changes are auditable `DomainEvent`s with lineage (`eventId`, `tenantId`, `actor`, `occurredAt`, `causationId`, `correlationId`, `payload`). Derived events use `followFrom()`.
- **Generic Core, Specific Tenants:** tenant-specific things live in `config/tenants/` (runtime) and `blueprints/tenants/` (conceptual), never in the Core.
- **Simplicity First:** no frameworks, no microservices, no empty packages. Add complexity only with evidence (and an ADR).

## Build & test

- **Node 22+**, native TypeScript type-stripping. **Zero external runtime dependencies.**
- `npm install` (only symlinks workspace packages). `npm test` or `node --test` — **must stay green.**
- Run the CLI: `node apps/cli/src/index.ts <command>`.
- Focused iteration: `npm run test:filter -- "AC-1"` (only tests matching pattern) or `node --test tests/<file>.test.ts` (single file).
- **Package boundaries:** import only via package entry points (`@daedalus/<pkg>`) and declared subpaths (e.g. `…/adapters`). **No deep imports** — `exports` blocks them on purpose.

## Research tools

`/last30days <topic>` (skill: `mvanhorn/last30days-skill`, installed globally) is available for **research before specs or ADRs**, not for routine implementation. Default to free sources (Reddit, HN, Polymarket, GitHub). Paid source keys (`SCRAPECREATORS_API_KEY`, `PERPLEXITY_API_KEY`, `XQUIK_API_KEY`, `XAI_API_KEY`, `BRAVE_API_KEY`) require explicit steward approval — they are not part of the default toolset. Engagement-scored summaries inform decisions; they do not override the canon.

## Git & collaboration protocol

- **One agent per branch at a time.** Coordinate via PRs, never edit the same branch concurrently.
- Branch names: `NNN-short-slug` (e.g. `006-revenue-visibility`).
- **A PR for every change.** Direct pushes to `main` are not allowed; `main` is the default branch.
- **An ADR** (`governance/decisions/ADR-NNN-*.md`) for any structural/architectural decision or deviation from these principles.
- PR descriptions are the async handoff: state *what changed*, *acceptance results*, and *open decisions*.

## Never commit

- `.data/` (runtime event logs / work-areas) — gitignored.
- Secrets / API keys / tokens (use env vars or a secret manager).
- Real tenant data or PII of any kind.

## Using multiple agents

Pick the agent per task (e.g. opencode for fast local iteration, Claude Code for spec/ADR-driven slices, a reviewer agent for adversarial review). They stay consistent because they all read this file + the canon. Tool-specific config:
- **opencode:** reads `AGENTS.md` automatically; see [`opencode.json`](opencode.json) for shared instructions. Define custom agents/modes per opencode docs.
- **Claude Code:** `CLAUDE.md` imports this file.
