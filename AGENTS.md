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
- **One worktree per session** ([ADR-008](governance/decisions/ADR-008-worktree-per-session.md)). Every agent session runs in its own `git worktree` bound to one branch — a `git checkout` in one worktree cannot wipe another's working tree. Bootstrap with [`tools/scripts/new-session.sh`](tools/scripts/new-session.sh). Detailed worked example: [`docs/agent-orchestration.md`](docs/agent-orchestration.md).
- Branch names: `NNN-short-slug` (e.g. `006-revenue-visibility`). Optional `-<agent-tag>` suffix for provenance (e.g. `050-atlas-spec-ratify-claude`).
- **A PR for every change.** Direct pushes to `main` are not allowed; `main` is the default branch.
- **An ADR** (`governance/decisions/ADR-NNN-*.md`) for any structural/architectural decision or deviation from these principles.
- PR descriptions are the async handoff: state *what changed*, *acceptance results*, and *open decisions*.
- **Before any in-worktree checkout** (rare with the worktree pattern, but possible for cross-branch reads), commit or stash first. Git's `pre-checkout` hook fires *after* the worktree update and cannot prevent loss of uncommitted edits (verified empirically on git 2.53 — see [ADR-008 §4](governance/decisions/ADR-008-worktree-per-session.md)).

## Never commit

- `.data/` (runtime event logs / work-areas) — gitignored. Each worktree has its own `.data/`; tests are isolated by `mkdtemp` per the existing helpers.
- Secrets / API keys / tokens (use env vars or a secret manager).
- Real tenant data or PII of any kind.

## Using multiple agents

Pick the agent per task (e.g. opencode for fast local iteration, Claude Code for spec/ADR-driven slices, a reviewer agent for adversarial review). They stay consistent because they all read this file + the canon. **Each agent session runs in its own `git worktree`** (per [ADR-008](governance/decisions/ADR-008-worktree-per-session.md)) so multiple agents can work in parallel without stepping on each other. Tool-specific config:
- **opencode:** reads `AGENTS.md` automatically; see [`opencode.json`](opencode.json) for shared instructions. Define custom agents/modes per opencode docs.
- **Claude Code:** `CLAUDE.md` imports this file.

Worked example of the multi-agent flow (open new session → bootstrap worktree → commit → push → PR → cleanup): [`docs/agent-orchestration.md`](docs/agent-orchestration.md).

## Authorised agent tooling

- **[ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** — a design-language reference skill (~2.9 MB, ~147 files under `.opencode/skills/`, gitignored). **Authorised per [ADR-012](governance/decisions/ADR-012-ui-ux-pro-max-skill.md)** with the following scope and guard rails:
  - **Scope:** consult the skill when designing a *new* user-facing visual surface (new Atlas panels, the Athena founder cockpit, future public web). **Do not** consult it for Theia (intentionally minimal per Spec 012 §1 + ADR-007), platform infrastructure, tests, parsers, or ADRs.
  - **Output:** the skill is a *process aid*, not a runtime dep. Its recommendations are inputs to the design process; the final colour, font, or spacing always comes from `apps/atlas/src/tokens.ts` (Atlas AC-5 token linter + Atlas AC-11 typography trio). Inline raw values in views are rejected by CI.
  - **Disallowed recommendations:** dark mode (would require its own spec), Fira/Inter-variable Google Fonts CDN (Spec 012 §7), Heroicons/Phosphor/Lucide (zero runtime deps). The PR description must list adopted vs rejected recommendations when the skill informs a change.
  - **Pin version** (per session); the Premium version is **not** adopted.

  Install per session/worktree: `npm install -g ui-ux-pro-max-cli && uipro init --ai opencode`. Re-install on a new machine or after a deliberate version bump.
