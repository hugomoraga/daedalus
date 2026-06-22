# Tasks 012 — Theia (task breakdown)

**Status:** Companion to Spec 012 + Plan 012
**Owner:** Theia implementer
**Version:** 0.1.1
**Last updated:** 2026-06-23

> Forward-planning only. Tasks begin after Spec 012 is ratified, ADR-007 records Theia as a development tool in `tools/`, the founder confirms visual-language reuse from Atlas, and the blocker-convention (Q2) is settled.

---

## PR 1 — Scaffold + types + parser skeleton

- [ ] T-01: Create `tools/theia/` directory with subdirs `src/`, `src/runners/`, `src/views/`, `tests/`, `tests/fixtures/`.
- [ ] T-02: Write `tools/theia/package.json` — name `@daedalus/theia`, private, type module, empty dependencies.
- [ ] T-03: Write `tools/theia/tsconfig.json` extending repo root.
- [ ] T-04: Write `src/types.ts` with `ProjectState`, `SpecCard`, `AdrRow`, `UseCaseRow`, `CodeEntry`, `Phase`, `DiffSummary`, `TestResult`, `BlockerEntry`.
- [ ] T-05: Write `src/parser.ts` skeleton: `export function parseRepo(rootPath: string): ProjectState` returning empty arrays. Add `// TODO PR-N:` markers for each parser phase.
- [ ] T-06: Write `src/cli.ts` stub — accepts `serve`, `check`, defaults to help text.
- [ ] T-07: Write `tests/parser.test.ts` — asserts the stub returns a `ProjectState` shape.
- [ ] T-08: Add `npm run theia` script to repo root `package.json` mapping to `node tools/theia/src/cli.ts`.
- [ ] T-09: Write `tools/theia/README.md` stub — placeholder; expanded in PR 8.
- [ ] T-10: Confirm `npm install` symlinks `@daedalus/theia` and `npm test` still passes.

## PR 2 — Parser: specs and tasks

- [ ] T-11: Implement `parseSpecs(rootPath)` — read `specs/*/spec.md`, extract Status, Phase, Version, Last updated, summary first paragraph.
- [ ] T-12: Implement `parseSpecCompletion(rootPath, slug)` — read `tasks.md` and `plan.md`, count `- [x]` and `- [ ]`.
- [ ] T-13: Implement Unknown fallback: when Status line missing or unparseable, return `status: 'Unknown'`, set `unknownReason` field.
- [ ] T-14: Build `tests/fixtures/repo-typical/` with 4 specs: Ratified Phase 2, Draft Phase 0, BLOCKED, Unknown.
- [ ] T-15: Tests: parses Ratified status correctly.
- [ ] T-16: Tests: parses Draft status correctly.
- [ ] T-17: Tests: parses BLOCKED status correctly.
- [ ] T-18: Tests: falls back to Unknown when Status line missing.
- [ ] T-19: Tests: computes task completion from tasks.md.
- [ ] T-20: Tests: combines tasks.md and plan.md counts when both exist.
- [ ] T-21: Tests: handles missing tasks.md gracefully (count = 0).

## PR 3 — Parser: ADRs + roadmap phases

- [ ] T-22: Implement `parseAdrs(rootPath)` — read `governance/decisions/ADR-NNN-*.md`, extract status and date.
- [ ] T-23: Implement `parsePhases(rootPath)` — read `docs/roadmap.md`, extract `## Phase N` headers and their milestone lists.
- [ ] T-24: Tests: parses 2 ADRs with status (Accepted, Proposed) and date.
- [ ] T-25: Tests: extracts 5 phases from a fixture roadmap.md.
- [ ] T-26: Tests: handles empty ADRs directory (empty array).
- [ ] T-27: Tests: handles missing roadmap.md (default to Phases 0–5 with no milestones).

## PR 4 — Parser: code inventory + use cases

- [ ] T-28: Implement `parseCodeInventory(rootPath)` — list top-level entries of `apps/`, `packages/`, `tests/`.
- [ ] T-29: Implement `parseUseCases(rootPath)` — regex over `apps/cli/src/index.ts` for `case "...":` patterns.
- [ ] T-30: Tests: fixture with a fake CLI file containing 5 cases.
- [ ] T-31: Tests: extracts use cases alphabetically sorted.
- [ ] T-32: Tests: handles missing CLI file gracefully.
- [ ] T-33: Tests: lists apps/, packages/, tests/ entries.

## PR 5 — Parser: blockers graph

- [ ] T-34: Implement `parseBlockers(rootPath, specs)` — for BLOCKED specs, extract unblocker list.
- [ ] T-35: Implement `computeNextUnlocks(specs)` — for each non-Ratified spec, count how many BLOCKED specs list it as unblocker.
- [ ] T-36: Choose blocker convention (Q2 resolution): regex over spec.md `Related:` field, OR `tools/theia/data/blockers.json` fallback.
- [ ] T-37: Document the chosen convention in `tools/theia/README.md` (placeholder if README not yet expanded).
- [ ] T-38: Build `tests/fixtures/repo-blocked/` with 1 BLOCKED spec and 2 unblockers.
- [ ] T-39: Tests: BLOCKED spec shows unblocker list.
- [ ] T-40: Tests: next unlocks ranking is correct (spec unlocking the most BLOCKED specs ranks first).
- [ ] T-41: Tests: handles specs with no `Related:` section (no blockers inferred).

## PR 6 — Runners: git diff summary

- [ ] T-42: Implement `runGitDiff(rootPath)` — spawns `git log --oneline main..HEAD`, `git diff --stat main..HEAD`, `git rev-parse --abbrev-ref HEAD`.
- [ ] T-43: Pure parser functions: given raw strings, return typed `DiffSummary`. Errors return `{ available: false, reason }`.
- [ ] T-44: Tests with mocked subprocess output: parses commit log correctly.
- [ ] T-45: Tests: parses `git diff --stat` correctly into per-file entries.
- [ ] T-46: Tests: returns `{ available: false }` when not in a git repo.
- [ ] T-47: Tests: handles no commits ahead of main ("No diff vs main").

## PR 7 — Runners: npm test, async

- [ ] T-48: Implement `runNpmTest(rootPath)` — spawns `npm test` async, captures stdout/stderr.
- [ ] T-49: Implement `parseNodeTestOutput(stdout)` — extracts pass count, fail count, list of failing test names.
- [ ] T-50: Tests with mocked subprocess output: parses typical `node:test` TAP output.
- [ ] T-51: Tests: handles non-zero exit (failures present).
- [ ] T-52: Tests: handles timeout gracefully (returns partial result).
- [ ] T-53: Tests: returns `{ running: true }` while in progress (UI shows "running...").

## PR 8 — Server + views + visual integration

- [ ] T-54: Implement `createTheiaServer({ port, host })` — `node:http` server. Bind to `127.0.0.1` only; reject `0.0.0.0` at startup.
- [ ] T-55: Route `GET /` → overview.
- [ ] T-56: Route `GET /specs/:slug` → spec detail.
- [ ] T-57: Route `GET /healthz` → `200 OK` JSON.
- [ ] T-58: Any other path → `404`. Non-GET → `405`.
- [ ] T-59: Trigger `runNpmTest` at server startup, async; store result for views.
- [ ] T-60: Implement `src/views/tokens.ts` — re-exports from `apps/atlas/src/tokens.ts`.
- [ ] T-61: Implement `src/views/layout.ts` — `renderLayout({ title, body })`.
- [ ] T-62: Implement `src/views/styles.css.ts` — string-exported CSS using tokens.
- [ ] T-63: Implement `src/views/overview.ts` — `renderOverview(state)`. Renders phase timeline (AC-1) + spec grid (AC-2) + ADRs section (AC-5) + code inventory (AC-6) + use cases (AC-7) + tests panel (AC-8) + diff summary (AC-9) + blockers section (AC-10).
- [ ] T-64: Implement `src/views/spec.ts` — `renderSpecDetail(slug, state)`. Per-spec detail page.
- [ ] T-65: Implement `src/cli.ts` fully — `serve --port <n> --host 127.0.0.1`, `check` (run parser + print summary, no server). Default port 8789; overridable via `THEIA_PORT` env var, then `--port` CLI flag (Spec Q0 resolution).
- [ ] T-66: Write `tools/theia/tests/token-linter.test.ts` — reuses Atlas's linter logic; checks Theia's views for raw colors / fonts / spacing.
- [ ] T-66a: Write `tools/theia/tests/no-platform-imports.test.ts` — static grep over `tools/theia/src/**` for `from "@daedalus/...` or `import("@daedalus/...")`. Only `src/views/tokens.ts` may match (re-exporting Atlas tokens); all other matches fail (AC-15).
- [ ] T-67: Write `tools/theia/tests/server.test.ts` — verifies 405 for non-GET, 404 for unknown paths, /healthz returns 200.
- [ ] T-68: Write `tools/theia/tests/views.test.ts` — asserts HTML contains expected cards, badges, and sections.
- [ ] T-69: Expand `tools/theia/README.md` — what it is, how to run, visual reuse from Atlas, "no LLM in v0" note, AC list.
- [ ] T-70: Final acceptance: `npm run theia` starts; `curl http://127.0.0.1:8789/` returns HTML; the overview shows the current repo state.

---

## Final acceptance sequence (run when all PRs merged)

- [ ] T-71: Run the evidence sequence from Plan 012 §5. Capture output to `docs/reviews/theia-evidence-v0.md`.
- [ ] T-72: Confirm Definition of Done from Plan 012 §4 is met.
- [ ] T-73: Tag the release commit `theia-v0.1.0` (or per repo convention; no formal versioning in v0).

---

*Build authorization requires Spec 012 ratification + ADR-007 + blocker-convention decision (Q2) + founder confirmation on visual-language reuse.*