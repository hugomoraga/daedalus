# Plan 012 — Theia (implementation plan)

**Status:** Companion to Spec 012
**Owner:** Theia implementer
**Version:** 0.1.0
**Last updated:** 2026-06-23

> This plan operationalizes Spec 012. It defines the file layout, the build order, the AC-to-test mapping, and the definition of done. Nothing here contradicts the spec. If they diverge, the spec wins and this plan is amended.

---

## 1. File layout

```
tools/theia/
├── README.md                 # what it is, how to run it, how it differs from Atlas
├── package.json              # name: "@daedalus/theia", no dependencies
├── tsconfig.json             # extends repo root tsconfig (Node 22 native)
├── src/
│   ├── cli.ts                # entry point: parseArgs, dispatch "serve" / "check"
│   ├── server.ts             # createTheiaServer: HTTP handler, route dispatch
│   ├── parser.ts             # parseRepo(rootPath): ProjectState — the core pure function
│   ├── types.ts              # ProjectState, SpecCard, AdrRow, UseCaseRow, DiffSummary, TestResult
│   ├── runners/
│   │   ├── git.ts            # git log/diff/branch via child_process
│   │   └── tests.ts          # npm test runner, async, output parser
│   └── views/
│       ├── layout.ts         # renderLayout({ title, body }) — page chrome
│       ├── overview.ts       # renderOverview(state) — main view
│       ├── spec.ts           # renderSpecDetail(slug, state) — per-spec deep view
│       ├── tokens.ts         # RE-EXPORTS from apps/atlas/src/tokens.ts (single source)
│       └── styles.css.ts     # string-exported CSS using tokens
└── tests/
    ├── parser.test.ts        # parser unit tests with fixture repos
    ├── parser-deterministic.test.ts  # AC-14
    ├── server.test.ts        # route dispatch, 405 for non-GET (Theia AC-5 read-only)
    ├── runners-git.test.ts   # git output parsing
    ├── runners-tests.test.ts # npm test output parsing
    ├── views.test.ts         # snapshot-ish: HTML contains expected cards/badges
    ├── token-linter.test.ts  # AC-11: no raw colors/fonts/spacing
    └── fixtures/
        ├── repo-empty/       # repo with no specs, no ADRs
        ├── repo-typical/     # repo with a few specs of varied status
        └── repo-blocked/     # repo with one BLOCKED spec and unblockers
```

### Why this layout

- **`tools/theia/`** matches the `tools/` precedent (the repo currently has none, but the [Constitution](../../memory/constitution.md) treats the canon as code and the roadmap explicitly defers tooling to "later spec"; ADR-007 establishes the convention).
- **`src/parser.ts`** is the single pure function. Everything else (server, views, runners) is plumbing around the parser's output. This makes the parser trivially testable.
- **`src/runners/`** isolates external side effects (`git`, `npm`) behind small functions. Each runner takes a repo path and returns a typed value. Mockable in tests.
- **`src/views/`** is HTML-as-string, like Atlas. No template engine, no JSX, no framework.
- **`src/views/tokens.ts`** is the only place Theia touches design tokens, and it **re-exports** from `apps/atlas/src/tokens.ts` rather than redefining. If Atlas adds a token, Theia sees it. AC-11's linter checks the views but allows `tokens.ts` to import.

---

## 2. Build order

Eight PRs, each independently mergeable. Each PR keeps the test suite green and Theia runnable (even if incomplete).

### PR 1 — Scaffold + types + parser skeleton
- Create `tools/theia/` directory structure.
- Write `src/types.ts` with the type definitions for `ProjectState` and its parts.
- Write `src/parser.ts` with `parseRepo(rootPath)` returning a typed stub (empty arrays). Mark `TODO` comments for each parser phase.
- Write `tests/parser.test.ts` asserting the stub shape.
- Write `package.json` declaring `@daedalus/theia` with no dependencies.
- Write `tsconfig.json`.
- Write `README.md` (stub; expanded in PR 8).
- **AC covered:** AC-14 (parser is a function); structural setup.
- **Acceptance:** `npm run theia` exists; the parser runs without errors on the current repo and returns the typed shape.

### PR 2 — Parser: specs and tasks
- Implement `parseSpecs(rootPath)` and `parseSpecCompletion(rootPath, slug)`.
- Read `specs/NNN-*/spec.md` first paragraph (regex for `**Status:**` and `**Last updated:**`).
- Read `specs/NNN-*/tasks.md` and `plan.md`, count `- [x]` and `- [ ]`.
- Handle missing files (count = 0).
- Tests: fixtures `repo-typical` with 4 specs (Ratified, Draft, BLOCKED, Unknown).
- **AC covered:** AC-2 (card data source), AC-3 (status parsing + Unknown fallback), AC-4 (task completion).

### PR 3 — Parser: ADRs + roadmap phases
- Implement `parseAdrs(rootPath)`.
- Read `governance/decisions/ADR-NNN-*.md`, extract status (Proposed / Accepted / Superseded) and date.
- Implement `parsePhases(rootPath)` reading `docs/roadmap.md` for `## Phase N` headers.
- Tests: fixture with 2 ADRs and 3 phases.
- **AC covered:** AC-5, AC-1 (phase timeline data).

### PR 4 — Parser: code inventory + use cases
- Implement `parseCodeInventory(rootPath)` — directory listing of `apps/`, `packages/`, `tests/`.
- Implement `parseUseCases(rootPath)` — regex over `apps/cli/src/index.ts` for `case "...":` patterns.
- Tests: fixture with a fake CLI file containing 5 cases.
- **AC covered:** AC-6, AC-7.

### PR 5 — Parser: blockers graph
- Implement `parseBlockers(rootPath, specs)`.
- Read each `spec.md` for `BLOCKED` status + unblocker list (regex or convention chosen at Q2 resolution).
- Compute "next unlocks" — for each non-Ratified spec, count how many BLOCKED specs list it as an unblocker.
- If no convention works, fall back to a `tools/theia/data/blockers.json` file maintained manually (documented).
- Tests: fixture `repo-blocked`.
- **AC covered:** AC-10.

### PR 6 — Runners: git diff summary
- Implement `runGitDiff(rootPath)` — invokes `git log --oneline main..HEAD`, `git diff --stat main..HEAD`, `git rev-parse --abbrev-ref HEAD`.
- Pure functions: given the strings, return typed `DiffSummary`.
- Tests with mocked subprocess output (no real git needed in CI).
- **AC covered:** AC-9.

### PR 7 — Runners: npm test, async
- Implement `runNpmTest(rootPath)` — spawns `npm test`, captures stdout/stderr, parses `node:test` TAP output.
- Async; server starts before tests complete.
- Tests with mocked subprocess output.
- **AC covered:** AC-8.

### PR 8 — Server + views + visual integration
- Implement `createTheiaServer({ port, host })` using `node:http`. Port defaults to 8789; overridable via `THEIA_PORT` env var, then `--port` CLI flag (Spec Q0 resolution).
- Routes:
  - `GET /` → overview
  - `GET /specs/:slug` → spec detail
  - `GET /healthz` → `200 OK`
  - anything else → `404`
  - non-GET → `405`
- Bind to `127.0.0.1` only; reject `0.0.0.0`.
- Implement `views/overview.ts`, `views/spec.ts`, `views/layout.ts`, `views/styles.css.ts`.
- Reuse Atlas tokens via re-export from `apps/atlas/src/tokens.ts`.
- Implement `cli.ts`: `serve` and `check` subcommands.
- Add `npm run theia` script to root `package.json` mapping to `node tools/theia/src/cli.ts serve`.
- Expand `README.md`.
- **AC covered:** AC-1 (timeline render), AC-2 (grid render), AC-8 (async tests panel with running-placeholder), AC-11 (token linter), AC-12 (local-only + 405), AC-13 (zero deps), AC-15 (no platform imports — `tests/no-platform-imports.test.ts`).

---

## 3. AC-to-test mapping

| AC | Test file | Test name |
|---|---|---|
| AC-1 | `views.test.ts` | "overview renders phase timeline with active phase highlighted" |
| AC-2 | `views.test.ts` | "overview renders spec grid with completion bars" |
| AC-3 | `parser.test.ts` | "parses Ratified status", "falls back to Unknown when Status line missing" |
| AC-4 | `parser.test.ts` | "computes task completion from tasks.md and plan.md" |
| AC-5 | `parser.test.ts` | "parses ADR list with status and date" |
| AC-6 | `parser.test.ts` | "lists apps/, packages/, tests/ entries" |
| AC-7 | `parser.test.ts` | "extracts CLI use cases from index.ts" |
| AC-8 | `server.test.ts` | "tests panel shows pass/fail counts after npm test" |
| AC-9 | `runners-git.test.ts` | "git diff summary parses log and stat output" |
| AC-10 | `parser.test.ts` | "computes next unlocks ranking from BLOCKED specs" |
| AC-11 | `token-linter.test.ts` | "no raw colors / fonts / spacing outside scale" |
| AC-12 | `server.test.ts` | "server rejects binding to 0.0.0.0" |
| AC-13 | (static check) | `tools/theia/package.json` has empty `dependencies` |
| AC-14 | `parser-deterministic.test.ts` | "parser output is byte-identical on two runs" |

---

## 4. Definition of done

Theia v0 is done when **all** of the following hold:

1. All 8 PRs merged; `main` is green.
2. `npm run theia` starts the server on `127.0.0.1:8789` in under 2 seconds on a warm repo.
3. `npm test` (root) is still green with Theia's tests included.
4. `tools/theia/package.json` has no `dependencies`.
5. The token linter (`tools/theia/tests/token-linter.test.ts`) passes.
6. The founder has opened `http://127.0.0.1:8789` and confirmed the overview shows the current state of the project without manual setup.
7. The README at `tools/theia/README.md` documents: how to run, how it differs from Atlas, the visual reuse contract, and the "no LLM in v0" note.

---

## 5. Evidence run (how we know it works)

Before declaring done, run this manual sequence and capture the output:

1. `npm install` from repo root — confirm `@daedalus/theia` symlinks.
2. `npm test` — confirm all tests pass (existing + new).
3. `npm run theia` — confirm server starts.
4. `curl -s http://127.0.0.1:8789/` — confirm HTML returns; eyeball the overview.
5. `curl -s -X POST http://127.0.0.1:8789/` — confirm `405 Method Not Allowed`.
6. `curl -s http://127.0.0.1:8789/specs/006-core-value-chain-completion` — confirm spec detail renders.
7. `ss -ltn | grep 8789` (or equivalent) — confirm only `127.0.0.1:8789` is bound.
8. Visual: open in a browser; confirm fonts are the trio, palette is Atlas's, spacing is on the scale.
9. Diff sanity: confirm the "Diff summary" section matches `git log --oneline main..HEAD`.

Capture step 4's HTML and a screenshot of step 8 in `docs/reviews/theia-evidence-v0.md` for the record.

---

## 6. Out-of-scope for v0 (will be its own spec when needed)

- LLM-backed "spec drafting assistant" — Spec 012 v2.
- Line-level diff rendering.
- Per-package test runs.
- Caching of parser output between requests.
- Multi-machine serving.
- Authentication.
- Writing/editing from the UI.

---

*Subordinate to Spec 012. Build authorization requires Spec 012 ratification and ADR-007 (Theia as development tool in `tools/`).*