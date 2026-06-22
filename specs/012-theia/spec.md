# Spec 012 — Theia (Project Status Visualizer)

**Status:** Draft · Tooling · not a platform capability (not on the [Roadmap](../../docs/roadmap.md))
**Type:** Development tool · read-only project-state visualizer
**Owner:** Stewards
**Version:** 0.1.1
**Last updated:** 2026-06-23

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* Theia does and *why*, not *how*. Conceptual — no schema, no API contract, no UI markup in this file.

> **Scope.** Theia is a **development tool**, not part of the Daedalus platform. It lives in `tools/theia/`, peer to `apps/` and `packages/`, and is never imported by platform code. It is the founder's window onto the state of the project itself: what specs exist, what was ratified, what's blocked, what's in code, what tests pass, what's the next unlock.

> **Naming.** Theia (Θεία) is the Titanide of the broad sight, sister of Helios. In the project's naming convention (Atlas for mission control, Daedalus for the platform), Theia is the developer-facing counterpart: the one who sees the whole project at a glance. Theia is **Powered by Daedalus Platform** and reads the same canon Atlas reads, but reads the *repo*, not the *event stream*.

---

## 1. Summary

Theia is a **read-only, locally-served visualizer** of the Daedalus project's own state. It parses the repository's structured artifacts (`specs/`, `governance/decisions/`, `apps/`, `packages/`, `tests/`, `docs/roadmap.md`) and renders a single-page overview that answers four questions at a glance:

1. **Where are we?** — Which roadmap phase is active. Which specs are ratified, draft, blocked, unknown.
2. **What's done?** — Per spec: task completion %, which use cases exist in code, which tests pass.
3. **What's blocked?** — Which specs are blocked, what their unblockers are, and which spec would unblock the most downstream work.
4. **What changed?** — Git diff summary against `main`: files changed, lines added/removed, recent commits.

Theia runs locally via `npm run theia`, serves on `http://127.0.0.1:8789`, uses Atlas visual tokens (no new design system), has **zero external runtime dependencies**, and is **read-only** with respect to the repo and the platform. It never writes, never imports from `@daedalus/*` packages (it only *reads* files), and never executes platform code paths.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **Constitution** | Obeys all ten principles as applicable to a *development tool*. Key: *Spec-Driven Development* (this spec); *Simplicity First* (zero deps, vanilla Node); *Auditability by Default* (the parser's inputs and outputs are deterministic and testable); *Generic Core, Specific Tenants* (Theia is project-scoped, never tenant-scoped — it reads the repo, not events). |
| **Technical Principles** | Respects the hexagonal intent: Theia is a tool that reads the **structure** of the project, not a driving adapter of the platform. It does not consume the EventStorePort, projections, or any use case. |
| **Atlas (Spec 007, ADR-005)** | Theia **reuses Atlas's visual tokens** (`tokens.ts`) so the developer's eye doesn't context-switch. It does **not** share code with Atlas's runtime — Atlas is a driving adapter over tenant events; Theia is a static analyzer over the repo. Different concerns, same visual language. |
| **Roadmap** | Theia is **not on the roadmap**. It is tooling, not a capability. The roadmap tracks what the platform *does*; Theia tracks how the *project* is advancing. |
| **ADR-005 (ATLAS driving adapter)** | Same read-only-by-construction posture applies to Theia. Theia never writes to the repo, never writes events, never mutates platform state. It is the most conservative adapter possible: it only reads files. |

---

## 3. Goals

1. **Answer "where are we?" in one glance.** A timeline of phases 0–5 with the active phase highlighted, plus a grid mapping specs to phases with their status.
2. **Make progress visible per spec.** Each spec shows its task completion (`- [x]` count vs `- [ ]`), its status, and a link to `spec.md`, `plan.md`, `tasks.md`.
3. **Surface blockers and unlocks.** Blocked specs display their unblocker list; a "next unlocks" view ranks specs by how many downstream specs they would unblock.
4. **Show the delta.** A diff summary against `main`: commits since fork, files changed, lines added/removed. Per-file line-level diff is **out of scope** for v0.
5. **Show tests at a glance.** At startup, run `npm test` once; display pass/fail counts and a list of failing tests with their names.
6. **Reuse Atlas's visual language.** Same fonts, same palette, same spacing scale, same micro-labels. No new design system.
7. **Stay out of the way.** One HTTP process, one port, zero deps, starts in under 2 seconds on a warm repo.

---

## 4. What Theia reads vs what it does not

### Reads (read-only, always)

| Source | What is extracted |
|---|---|
| `specs/NNN-*/spec.md` | `Status:` line, `Phase:` reference, `Version:`, `Last updated:`, `## 1. Summary` (first paragraph for card preview) |
| `specs/NNN-*/tasks.md` and `plan.md` | Count of `- [x]` and `- [ ]` items (markdown checkboxes) |
| `governance/decisions/ADR-NNN-*.md` | Status (Proposed / Accepted / Superseded), date, title |
| `apps/cli/src/index.ts` | List of `case "..."` commands — the **use case surface** |
| `apps/`, `packages/`, `tests/` | Directory listing |
| `docs/roadmap.md` | Phase headers (## Phase N — ...), milestone lists |
| `package.json` | Name, scripts |
| `.git/` (via `git` CLI) | `git log --oneline main..HEAD`, `git diff --stat main..HEAD`, current branch |
| `npm test` (via subprocess) | Pass/fail counts, list of failing test names |

### Does NOT read (deliberate non-goals)

- `.data/` (runtime event logs) — out of scope. Theia is about the **project**, not about **tenant state**. Atlas covers tenant state.
- Any `@daedalus/*` package internals via import — Theia only reads files by path; it does not import platform code.
- Real tenant data, PII, secrets — gitignored anyway.
- The constitution and technical principles as runtime inputs — these are stable canon; Theia renders the *consequences* (specs, ADRs), not the canon itself.

### Does NOT do (binding non-goals)

- Write to any file in the repo.
- Import from `@daedalus/*` packages.
- Execute platform use cases.
- Emit events, open network connections beyond `127.0.0.1`.
- Persist state across runs (no caching, no DB, no logs).
- Render line-level diffs (only `--stat`).
- Connect to an LLM. (v2 may add a "spec drafting assistant" — out of scope here.)
- Multi-user, multi-tenant, authentication.

---

## 5. Domain concepts (conceptual)

- **Project State.** A point-in-time snapshot of the repo's structured artifacts. Pure function of the filesystem + git. Deterministic; recomputed on every request.
- **Spec Card.** Per-spec rendered card: slug, status badge, phase badge, completion bar (`X / Y` tasks), last-updated date, summary preview, links to artifacts.
- **Phase Timeline.** Horizontal bar of phases 0–5, with the **active phase** computed as: the highest phase number for which at least one spec is `Ratified`. If no specs are ratified, the active phase is Phase 0.
- **Blocker Graph.** Each blocked spec lists its unblockers; a separate view computes "if spec X were ratified, how many specs would transition out of BLOCKED?"
- **Use Case Surface.** Flat list of CLI commands extracted from `apps/cli/src/index.ts`. Used to show "what's actually wired today."
- **Diff Summary.** `git log --oneline main..HEAD` plus `git diff --stat main..HEAD`. No per-line diff.
- **Test Run.** Result of executing `npm test` at Theia startup. Includes pass count, fail count, and list of failing test names. Re-running requires a Theia restart in v0.

---

## 6. Events

**Theia emits no events.** It is a tool, not a platform component. It runs locally, serves locally, and is not part of the event-sourced architecture.

If a future v2 adds an LLM-backed "spec drafting assistant," that interaction would happen via CLI subprocess, not via platform events.

---

## 7. Interaction constraints (binding)

- **Read-only by construction.** Theia reads files and runs `git` / `npm` commands. It never writes, modifies, or deletes any file in the repo.
- **Local-only.** Binds to `127.0.0.1` only. Never `0.0.0.0`.
- **No external network.** No CDN, no fonts download, no telemetry, no analytics.
- **Zero runtime dependencies.** `package.json` for Theia declares no `dependencies`. Same discipline as Atlas (ADR-005 §5).
- **Token discipline.** Visual styling reuses Atlas tokens. No raw colors, no new fonts. If a token is missing for a Theia-specific need, it is added to Atlas's `tokens.ts` (which both projects then import), never redefined locally.
- **No client-side state for project data.** Like Atlas, the browser is a renderer. State is recomputed on each request.
- **Polling, not push.** No SSE, no WebSocket. Refresh = manual (browser reload) or automatic on request (server recomputes per request).

---

## 8. Acceptance criteria

**AC-1 (Phase timeline).**
- *Given* the repo with the current spec set,
- *When* Theia serves the overview,
- *Then* a horizontal timeline renders phases 0–5, and the phase containing the most-recent ratified spec is highlighted as **active**. If no spec is ratified, Phase 0 is active.

**AC-2 (Spec grid).**
- *Given* the specs in `specs/`,
- *When* Theia serves the overview,
- *Then* a grid renders one card per spec, each showing: slug, status badge, phase badge, completion bar (`done / total`), last-updated date, summary preview, and links to `spec.md`, `plan.md`, `tasks.md`. Cards are sortable by phase, status, completion, and last-updated.

**AC-3 (Status parsing).**
- *Given* a `spec.md` with `**Status:** Ratified · Phase 2 (...)`,
- *When* Theia parses it,
- *Then* the spec card displays status = `Ratified` and phase = `2`. If the status line is missing or unparseable, the card displays `Unknown` with a visible warning indicator, and a global banner lists all specs with unknown status.

**AC-4 (Task completion).**
- *Given* a `tasks.md` with `N` checkboxes, of which `M` are `- [x]`,
- *When* Theia computes the spec's completion,
- *Then* the card displays `M / N` and a progress bar reflecting `M / N`. A `plan.md` checkbox count is added to the total if both files exist.

**AC-5 (ADRs list).**
- *Given* the ADRs in `governance/decisions/`,
- *When* Theia serves the overview,
- *Then* a section renders one row per ADR with: number, slug, status, date, and link to the ADR file. Sorted by number ascending.

**AC-6 (Code inventory).**
- *Given* the repo,
- *When* Theia serves the overview,
- *Then* a section lists what is in `apps/`, `packages/`, and `tests/`, with one row per top-level entry and a clickable link.

**AC-7 (Use case surface).**
- *Given* `apps/cli/src/index.ts` with `case "lead:create"`, `case "proposal:approve"`, etc.,
- *When* Theia parses the file,
- *Then* a section lists all CLI commands extracted from `case "...":` patterns. Sorted alphabetically.

**AC-8 (Test run at startup).**
- *Given* Theia is started,
- *When* the server is ready to accept requests,
- *Then* the Tests panel displays a "running…" placeholder while `npm test` runs in the background, and updates (without a server restart) to show: total tests, pass count, fail count, and (if any) the names of failing tests. A "Tests failed" warning banner appears if fail count > 0. The server is ready to accept requests **before** the test run completes (async, non-blocking startup).

**AC-9 (Diff summary).**
- *Given* the repo is a git repo with commits ahead of `main`,
- *When* Theia serves the overview,
- *Then* a section displays: current branch, commits since `main` (`git log --oneline main..HEAD`), and `git diff --stat main..HEAD`. If the repo has no commits ahead, the section displays "No diff vs main."

**AC-10 (Blockers and unlocks).**
- *Given* a spec with `Status: BLOCKED` and a `Related:` section listing unblockers,
- *When* Theia parses it,
- *Then* the spec card displays a "Blocked by" list with the unblocker specs/ADRs. A separate "Next unlocks" view ranks specs by how many downstream specs would transition out of BLOCKED if this spec were ratified.

**AC-11 (Atlas visual reuse).**
- *Given* Theia's HTML output,
- *When* a token linter runs against `tools/theia/src/views/*.ts`,
- *Then* the same rules as Atlas AC-5 apply: no raw color literals, no fonts outside the trio (`Inter Tight`, `Inter`, `JetBrains Mono`), no spacing outside the scale `4, 8, 12, 16, 24, 32, 48, 64, 96`.

**AC-12 (Local-only binding).**
- *Given* Theia is started,
- *When* a network probe checks open ports,
- *Then* only `127.0.0.1:8789` is bound. Binding to `0.0.0.0` is rejected at startup with an error.

**AC-13 (Zero runtime deps).**
- *Given* Theia's `package.json`,
- *When* inspected,
- *Then* `dependencies` is `{}` and `devDependencies` is empty (or contains only test-time tooling already in the repo). Theia does not introduce new packages to the workspace.

**AC-14 (Deterministic parser).**
- *Given* a fixed, **immutable** fixture repo (under `tools/theia/tests/fixtures/`, never mutated by tests),
- *When* Theia's parser runs twice against the fixture,
- *Then* the output is identical (byte-for-byte on the JSON the views consume). A test asserts this against the fixture, never against the live repo.

**AC-15 (No platform imports).**
- *Given* the source tree of Theia (`tools/theia/src/**`),
- *When* a static check greps for `from "@daedalus/...` or `import("@daedalus/...")`,
- *Then* **zero matches** are found. Theia reads the repo by path only; it does not import platform code. (Caveat: `tools/theia/src/views/tokens.ts` is the **single** exception — it re-exports from `apps/atlas/src/tokens.ts` for visual cohesion, and only for design tokens, not for logic.)

---

## 9. Non-goals (binding)

- **No writing to the repo.** No file mutations. No "auto-fix" suggestions.
- **No import of `@daedalus/*` packages.** Theia only reads files by path.
- **No execution of platform use cases.** Theia does not call any `*UseCase`.
- **No line-level diff rendering.** Only `git diff --stat` and commit log.
- **No LLM connection.** v2 may add a "spec drafting assistant" — out of scope here.
- **No multi-user, multi-tenant, or auth.** Local tool for the founder and stewards.
- **No persistence between runs.** No cache files. No SQLite. No daemon.
- **No new design tokens.** Reuses Atlas's `tokens.ts`. If a Theia-specific need arises, the token is added there (single source of truth) and consumed by Theia, not duplicated.
- **No external network.** No CDN, no telemetry.
- **No mobile-first.** Desktop developer view.

---

## 10. Risks

- **R1 — Parser drift.** If spec authors stop using the `**Status:**` convention, the parser misses cards. *Mitigation:* AC-14 (deterministic test against fixtures) catches regressions; AC-3 surfaces "Unknown" cards so drift is visible.
- **R2 — Token duplication.** A contributor adds raw colors to Theia, breaking the visual contract. *Mitigation:* AC-11 token linter, applied to `tools/theia/src/views/`. The linter rules live alongside Atlas's.
- **R3 — Test run slowness.** `npm test` could take minutes; blocking startup on it makes Theia feel slow. *Mitigation:* AC-8 fires `npm test` async at startup; the server is ready before tests complete. The "Tests" panel shows "running..." until done, then the result. v0.1 may block startup if too slow.
- **R4 — `npm test` in monorepo.** If the workspace has many packages, `npm test` at root runs everything. *Mitigation:* the test run is what it is; Theia shows whatever result comes out. If scoping per package becomes necessary, that's a follow-on spec.
- **R5 — Theia oversteps into "editing."** A future contributor adds a "click here to fix this spec" button. *Mitigation:* §9 non-goal "no writing to the repo" is binding; the server has no POST handler; any non-GET returns 405 (AC-12).
- **R6 — Tooling creeps into the platform.** Theia imports `@daedalus/core` to "reuse" something. *Mitigation:* §9 non-goal "no import of `@daedalus/*` packages" is binding, enforced by AC-15 (static grep). Theia is structurally separate.

---

## 11. Open questions

- **Q0 — Port configuration.** The default port is `8789`. If it's taken (e.g. two Theia instances), Theia fails to bind at startup. *Resolution:* the port is overridable via the `THEIA_PORT` env var; `--port <n>` CLI flag overrides `THEIA_PORT`. Document both in `tools/theia/README.md`.
- **Q1 — Active phase definition.** Is "active phase" = highest phase with a Ratified spec, or the highest phase with *any* spec (Draft included), or something the founder manually marks? *Recommendation: highest phase with a Ratified spec.* If no ratified specs, Phase 0 is active. Settle at implementation; flag if a better rule emerges.
- **Q2 — "Next unlocks" computation.** Computing downstream unblocks requires parsing each spec's `Related:` or similar field. Some specs may not list dependencies explicitly. *Recommendation:* parse a `Depends on:` or `Unblocked by:` line if present; fall back to manual maintenance in a `tools/theia/data/blockers.json` file. Document the chosen convention at implementation.
- **Q3 — Test output parsing.** `npm test` output format depends on the test runner (Node 22 native `node:test`). *Recommendation:* parse the standard `node:test` TAP-like output. If a future runner is added, extend the parser.
- **Q4 — Handling non-conventional files.** Some specs may have `notes.md`, `evidence/`, or other files beyond `spec.md` / `plan.md` / `tasks.md`. *Recommendation:* ignore them in v0. Theia lists directories; it does not deep-read every file.

---

## 12. Out of scope (binding)

- Implementation of any code beyond what is described here. Per Constitution Principle 8, no functionality outside an approved spec.
- Any connection to LLM providers, even for read-only "explain this spec" features.
- Any persistence, caching, or session state.
- Any modification to the constitution, technical principles, identity, or roadmap.
- Any modification to Atlas (Theia may *reuse* Atlas's tokens; it does not modify Atlas).
- This spec does **not** authorize any change to the Daedalus platform itself. Theia is a development tool.

---

## 13. Activation criteria (binding)

T-01…T-N in `tasks.md` may begin only when **all** of the following hold:

1. **Spec 012 is ratified** by stewards.
2. **An ADR records Theia's introduction** as a development tool in `tools/`, distinct from `apps/` and `packages/`, with explicit non-platform status.
3. **The founder confirms** the visual language reuse from Atlas is acceptable (no separate design system).
4. **An initial blocker-convention is chosen** (Q2 resolution).

---

## 14. Companion artifacts

- **`plan.md`** — implementation plan: file layout, parsing order, view layering, AC-to-test mapping, evidence run, definition of done.
- **`tasks.md`** — task breakdown T-01…T-N, forward-planning, not a build authorization.

---

*Subordinate to the Constitution and Technical Principles. A development tool — not a platform capability. Read-only by construction, local-only by binding, deterministic by test.*