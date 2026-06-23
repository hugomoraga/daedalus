# Daedalus Backlog

Operational follow-ups that are neither capabilities (not in `specs/`) nor
architectural decisions (not in `governance/decisions/`). Each item is a
self-contained section that the Theia backlog parser can extract by
matching field labels — see *Parser contract* below.

This file is the canonical source of truth for non-spec / non-ADR work
items. Per the Constitution (*Auditability by Default*) and the
*Decisions live in the repo, not in any agent's chat memory* working
agreement (AGENTS.md), nothing here should live only in a chat
transcript or PR description.

## Parser contract (consumed by Theia — Spec 012 follow-up)

For each section whose header matches `^## ([A-Z]+-\d+) — (.+)$`:

| Field    | Regex                              | Cardinality |
|----------|------------------------------------|-------------|
| ID       | group 1 of header                  | exactly one |
| Title    | group 2 of header                  | exactly one |
| Status   | `^\*\*Status:\*\* (.+)$`           | exactly one |
| Kind     | `^\*\*Kind:\*\* (.+)$`             | exactly one |
| Source   | `^\*\*Source:\*\* (.+)$`           | exactly one |
| Affects  | `^\*\*Affects:\*\* (.+)$`          | zero or one |

Prose after the structured block is human context; the parser ignores
it. Authors should avoid lines that start with `**Status:**`,
`**Kind:**`, etc., in the prose so the parser's anchor regexes don't
fire on context lines.

### Allowed values

- **Status**: `open` | `in-progress` | `wontfix` | `done`
- **Kind**: `bug` | `follow-up` | `churn` | `deprecation`

### ID scheme

`[KIND-PREFIX]-NNN` — zero-padded 3 digits, per-kind counter that **never
reuses a number** even when an item is deleted or marked `wontfix`. This
keeps IDs stable for cross-references in commits and PR descriptions
(`Refs BUG-001`, `Fixes UX-001`).

Current prefix assignments:

| Kind         | Prefix     | Counter range used |
|--------------|------------|--------------------|
| bug          | `BUG-`     | `001`              |
| follow-up    | `UX-`      | `001`              |
| churn        | `CHORE-`   | `001`              |
| test flake   | `TEST-`    | `001`              |
| deprecation  | `DEP-`     | (none yet)         |

## When to add an item

Add a backlog entry when one of these holds:

- A test fails or flakes and the cause is unclear / non-trivial.
- A behavior surfaces during work that should be fixed but isn't part
  of the current PR (out of scope).
- An ad-hoc cleanup is identified (stale branches, dead code, drifted
  docs) but warrants tracking rather than ad-hoc action.
- A deprecation is decided informally but hasn't earned its own ADR.

Do **not** add an item when:

- The work belongs to an existing spec — extend the spec instead.
- The decision is architectural — write an ADR instead.
- The fix is trivial and obvious — just fix it in the current PR.

---

## BUG-001 — tools/theia fixture test fails on main (AC-6 expects ≥3 apps, has 1)

**Status:** open
**Kind:** bug
**Source:** observed during PR #73 / #75 verification (pre-existing on main)
**Affects:** tools/theia/tests/parser-inventory-use-cases.test.ts

Theia PR 4 (#67) shipped `parseCodeInventory` expecting the
`tools/theia/tests/fixtures/repo-typical` fixture to have ≥3 apps, but
only `cli` was added when the fixture was originally scaffolded (PR 3,
#65). The fixture should be expanded (e.g. add `atlas` and a third
app) or the assertion should be loosened to ≥1.

Symptom in test output:

```
not ok 213 - AC-6: parseCodeInventory returns the fixture's apps + packages
AssertionError: false == true (apps.length >= 3)
```

Unrelated to Atlas / seeder / ADR-008 work — fix in its own PR.

---

## TEST-001 — flaky "evidence run" in value-chain-cli

**Status:** wontfix
**Kind:** bug
**Source:** intermittent across multiple test runs in #73 / #75 sessions
**Affects:** tests/engine-evidence-run.test.ts (likely; see below)

Closed in PR #89 as wontfix — the underlying flake was already fixed
before the entry was authored, and the `Affects:` path was stale.

**Why wontfix, not done.** The fix landed in a separate stream and is
not attributable to TEST-001. Marking `done` here would mis-attribute
work that was done out-of-band.

**What the entry got wrong.**
- *Path.* `apps/cli/tests/value-chain-cli.test.ts` does not exist.
  The CLI was refactored into per-command modules by `refactor(cli):
  split monolith index.ts into per-command modules` (PR #34, commit
  `31edee46`, 2026-06-21 22:59), and CLI tests now live at the repo
  root in `tests/`. The most likely test the author meant is
  `tests/engine-evidence-run.test.ts` ("evidence run: full lead-to-
  payment walk with human gate at paid → closed"), which exercises
  exactly the flow described.

**Underlying flake — already fixed.** The flake (engine polling race
in `runFor`) was fixed in commit `4aa75fa` (`test(workflow-engine):
stabilize runFor helper against engine polling race`, 2026-06-21
23:54, shipped via PR #46) — *about 26 hours before the TEST-001 entry
was authored.* The fix replaced fixed-time `setTimeout` with a
"stable-stream" poll (wait until the event stream stops growing for
150 ms, with a hard `maxMs` ceiling). Same commit also bumped
`runFor` ceilings in `engine-declarative.test.ts`, `engine-human-
gate.test.ts`, and `engine-multi-tenant.test.ts` for buffer.

**Verification done in PR #89.** With Node 22 (the project's required
runtime, `engines.node >=22.6.0`), 5 full-suite runs each surfaced
the same 2 consistent failures (both fixed by the BUG-001 fixture
expansion in PR #88) and no flakes. The suspect test
`tests/engine-evidence-run.test.ts` was also run 20× back-to-back
with no failures. No active flake attributed to the original TEST-001
description exists on `main`.

**Recommended follow-up (out of TEST-001 scope).** The Theia
backlog parser (Spec 012 follow-up) could optionally validate the
`Affects:` path on entry creation so stale paths cannot survive into
the parser's index. Tracked separately; not addressed here.

---

## CHORE-001 — stale remote branches from merged PRs

**Status:** done
**Kind:** churn
**Source:** session-end audit, 2026-06-22
**Affects:** origin (remote branches)

Closed in PR #85. The original 6-branch audit was extended to the full
set: **75 stale remote branches deleted** from `origin` (74 whose PRs
were merged into `main` + `020-social-to-opportunity-mvp`, a closed PR
whose work was absorbed into Spec 014 via ADR-009). Each branch was
double-verified before deletion: `gh pr list --state merged --head <b>`
returned a merged PR, and the merge commit was verified as an ancestor
of `origin/main`. Active worktree branches were excluded.

After the prune, only `origin/main` and `origin/HEAD` remained on the
remote. The follow-up stale *local* worktrees (see CHORE-002) are a
separate concern tracked below.

---

## CHORE-002 — stale local worktrees left after merged PRs

**Status:** done
**Kind:** churn
**Source:** observed during CHORE-001 close-out, 2026-06-22
**Affects:** local worktrees (this machine)
**Closed:** 2026-06-22 (immediately after ADR-008 amendment, PR #86)

After PRs merge, the worktrees their sessions used are left behind on
the local machine. They consume disk and clutter `git worktree list`,
but they are not auto-removed. Per ADR-008 §3, worktree removal is part
of session-end cleanup; in practice the previous session did not always
run `git worktree remove`.

Snapshot at close-out of #85 (5 stale worktrees, all bound to branches
whose PRs are now on `main`):

- `daedalus-athena-founder-cockpit` (→ `017-athena-founder-cockpit`, PR #84)
- `daedalus-platform-api`           (→ `016-platform-api`, PR #83)
- `daedalus-spec-file-convention`   (→ `015-spec-file-convention`, PR #80)
- `daedalus-spec-file-convention-impl` (→ `081-spec-file-convention-impl`, PR #81)
- `daedalus-spec015-t28-closure`    (→ `082-spec015-t28-closure`, PR #82)

Cleanup (manual; non-urgent):

```
git worktree remove /path/to/worktree
```

**Resolution.** All 5 stale sibling worktrees were removed on 2026-06-22 via `git worktree remove <abs-path>` from the main checkout, immediately after PR #86 merged. `git worktree list --porcelain` post-cleanup shows only the main checkout and any in-flight session worktrees (in-repo at `.worktrees/<slug>/`).

Future prevention: per the migration note in [ADR-008 §Amendment](../../governance/decisions/ADR-008-worktree-per-session.md#amendment--2026-06-22-in-repo-worktrees), the sibling-style worktrees that produced this backlog entry are no longer created — new sessions land in `.worktrees/<slug>/`, which keeps the parent directory (`~/Proyectos/`) free of stale project-named entries. So CHORE-002 is structurally unlikely to recur.

---

## UX-001 — Navigate marquee starts auto-scrolling on load

**Status:** done
**Kind:** follow-up
**Source:** session-end note, 2026-06-22
**Affects:** apps/atlas/src/templates/paper.ts

`animation: navigate-scroll 40s linear infinite` runs from page load.
Founder may prefer the marquee to stay paused until the first hover —
a common UX pattern for marquees (avoids visual motion competing with
the metrics above the Navigate section).

Fix: `animation-play-state: paused` default on `.navigate-track`, then
unpause via `.navigate-rail:hover .navigate-track { animation-play-state:
running; }`. ~3-line CSS change. No markup change needed.

Currently the behavior is the opposite (pauses on hover, runs on load)
which feels more "demo / showcase" than "production mission control."

Resolved by PR #87 (`fix(atlas): pause Navigate marquee until hover`).
Backlog status flipped `open → done` in this PR (2026-06-23 hygiene
sweep — PR #87 landed the fix but didn't update this entry).

---

## UX-002 — Theia spec grid cards don't link to the per-spec detail view

**Status:** done
**Kind:** follow-up
**Source:** session-end note, 2026-06-22
**Affects:** tools/theia/src/views/overview.ts

The overview's spec grid (`renderSpecGrid`, `tools/theia/src/views/overview.ts:78`)
renders each spec as a `<div class="theia-card">` containing the slug,
title, status badge, and progress bar — but the slug is plain text, not
a link. Clicking a card does nothing; the per-spec detail page already
exists (`renderSpecDetail`, `tools/theia/src/views/spec.ts:7`) and is
already routed (`GET /specs/:slug` in `tools/theia/src/server.ts:114`),
so the destination is wired — only the affordance is missing.

Fix: wrap the card body in an `<a href="/specs/${slug}">` and add a
hover treatment so the affordance is visible (the global `a` rule
already adds a bottom border on hover; the `.theia-card` border will
need `border-bottom: 1px solid var(--rule)` preserved or replaced by a
hover-only border-color shift). ~5-line view change + one regression
test asserting `href="/specs/…"` is present for each card.

No spec change needed: Spec 012 already mandates the detail view and
the overview's spec grid; this entry closes a gap between the two, it
does not add a capability.

Resolved by PR #92: card is now `<a class="theia-card theia-card-link" href="/specs/<slug>">`; `.theia-card-link:hover { border-color: var(--ink) }` makes the affordance visible. Regression test added (`UX-002: each spec grid card links to /specs/<slug>` in `tools/theia/tests/views.test.ts`).

---

## UX-003 — Theia spec detail page should enumerate tasks with their state

**Status:** done
**Kind:** follow-up
**Source:** session-end note, 2026-06-22
**Affects:** tools/theia/src/views/spec.ts, tools/theia/src/parser/completion.ts, tools/theia/src/parser/specs.ts, tools/theia/src/types.ts, tools/theia/src/views/layout.ts

The per-spec detail page (`renderSpecDetail`, `tools/theia/src/views/spec.ts:7`)
shows the overall `done/total` and a progress bar, but the individual
tasks are not enumerated — the founder has to open `tasks.md` to see
which `T-NN` are done and which are pending.

Fix: add a `taskList: TaskItem[]` field to `SpecCard` (new `TaskItem`
type with `id`, `text`, `done`, `section`). Parser: `parseTaskList`
walks `tasks.md`, captures canonical `- [x] T-01: text` lines, and
groups them by the most recent `## Heading` (empty string when no
heading). View: render the list grouped by section, with `[x]` / `[ ]`
marks, the task id, and the text; done items get a strikethrough and
the `--ok` color on the mark; pending items use `--neutral`. CSS lives
in `tools/theia/src/views/layout.ts` (token-disciplined: only `var(--*)`
colors, only spacing-scale `4/8/16/24` values, no raw hex).

Resolved by PR #93. The fixture's `001-ratified-p2/tasks.md` and
`plan.md` were also brought into Spec 015 canonical form (colon after
the id, real `## PR N — title` sections) — they previously used a
non-canonical `- [x] T-01 text` shape that the strict parser rejected.

---

## UX-004 — Theia should render the backlog as a panel

**Status:** done
**Kind:** follow-up
**Source:** session-end note, 2026-06-23
**Affects:** tools/theia/src/parser/, tools/theia/src/views/, tools/theia/src/types.ts

`docs/backlog.md` is the canonical catalog of follow-ups, bugs, churn,
and deprecations (currently 7 entries: BUG-001, TEST-001, CHORE-001/002
done; UX-001/002/003 done; the same file already documents a parser
contract in its "Parser contract (consumed by Theia — Spec 012 follow-up)"
section). Theia reads `docs/roadmap.md` (phases) and `specs/*/spec.md`
(specs) but does NOT read `docs/backlog.md`, so the catalog is invisible
without opening the file by hand.

This entry asks for a Theia panel that surfaces the backlog: one
`Backlog` section in the overview listing every entry, grouped or
filterable by `Status` (open / in-progress / wontfix / done) and
`Kind` (bug / follow-up / churn / deprecation). Read-only, parsed
once at startup. The parser contract in the file's own header is
the spec for what to extract.

**Why not a new spec.** Spec 012 already establishes "Theia reads the
repo's structured artifacts" and the parser contract is already
documented in `docs/backlog.md` itself. UX-004 closes the gap between
documented contract and implementation, exactly like UX-002 and UX-003.

**Implementation shape (sketch).**
- New `tools/theia/src/parser/backlog.ts` — pure function
  `parseBacklog(rootPath): BacklogItem[]` that walks `docs/backlog.md`
  and pulls `(id, title, status, kind, source, affects)` per the
  documented regexes. Section header `^## ([A-Z]+-\d+) — (.+)$`,
  field lines `^\*\*(Status|Kind|Source|Affects):\*\* (.+)$`. Prose
  is captured as `body` for the view (escape-html'd in render).
- `tools/theia/src/types.ts` — new `BacklogItem` type, new
  `backlog: BacklogItem[]` field on `ProjectState`.
- `tools/theia/src/parser.ts` — call `parseBacklog` alongside the
  other parsers.
- `tools/theia/src/views/overview.ts` — new `renderBacklogSection(state)`
  that renders a single grouped table (Status as the row group,
  Kind as a column or sub-group). Use existing tag/badge patterns.
- `tools/theia/src/views/layout.ts` — minimal CSS, token-disciplined.
- Tests in `tools/theia/tests/parser-backlog.test.ts` (new file) +
  extension of `tools/theia/tests/views.test.ts`. The fixture
  `tools/theia/tests/fixtures/repo-typical/` already has a
  `docs/` directory; the test should use that.

**Out of scope.**
- Editing the backlog from Theia (read-only by Spec 012's design).
- Per-row deep links (no GitHub-anchored targets; entries don't carry
  a path).

Resolved by PR #96: new `tools/theia/src/parser/backlog.ts` implements
the parser contract documented in the file's own header. `ProjectState`
gains a `backlog: BacklogItem[]` field; the overview renders a new
`Backlog` section grouped by `Status` (open → in-progress → wontfix →
done, with unknown statuses trailing) and per-row columns for id,
kind, title, and the (optional) affects file. Each row has a
collapsed `<details>` carrying the prose body. 12 new tests (8 parser
+ 4 view). Fixture gets `tools/theia/tests/fixtures/repo-typical/docs/backlog.md`
with 3 representative items (one with Affects, one without, one
in-progress).

---

## UX-005 — Phase cells in Theia should be clickable, opening a per-phase detail view

**Status:** done
**Kind:** follow-up
**Source:** session-end note, 2026-06-23
**Affects:** tools/theia/src/views/overview.ts, tools/theia/src/server.ts, tools/theia/src/views/, tools/theia/src/types.ts

The phase timeline in the Theia overview
(`renderPhaseTimeline` in `tools/theia/src/views/overview.ts:58`) renders
each phase as a `<div>`: number + title, the active one highlighted in
`--accent`. The cells are not clickable — there is no per-phase route.
The roadmap parser already extracts phase data
(`tools/theia/src/parser/phases.ts:27` → `Phase { number, title,
milestoneCount }`) and `parseRepo` wires it into `state.phases`, so the
*data* is ready; only the click affordance and the destination view
are missing.

**Scope of the fix.** Three things, all in `tools/theia/`:

1. **Link the cells.** Wrap each phase cell in `<a href="/phases/N">`
   (mirrors the UX-002 pattern: anchor replaces `<div>`, add a class
   that neutralises the global `a { color: accent; border-bottom }`
   rule and adds `border-color: var(--ink)` on hover).
2. **Add a route + view.** `GET /phases/:n` in `server.ts`, paired with
   a new `renderPhaseDetail(n, state)` in `tools/theia/src/views/phase.ts`
   (new file, parallel to `spec.ts`). The detail view shows: phase
   number, title, milestone count from the roadmap, and the list of
   specs whose `phase === n` (one row per spec, linking back to
   `/specs/<slug>`). The cells in the overview already render
   `state.activePhase` highlighted; the detail view can show "this
   phase is currently the active one" in the same `--accent` style.
3. **Cross-link back.** The detail view ends with `← back to overview`,
   matching the spec detail pattern.

**Out of scope.**

- Per-phase blocker graph / next-unlocks (that's a richer feature for
  a future follow-up; the spec detail view doesn't have it either).
- Per-milestone expansion of the roadmap body (the parser counts
  milestones but doesn't capture their text — separate change if
  needed).
- A `/phases/` index route (the timeline on the overview is already
  the index).

**Why not a new spec.** Spec 012 already establishes the per-spec
detail page pattern (and PR #96 wired the per-artifact back-link
convention). UX-005 extends the same pattern to phases; no new
capability, just a missing affordance. Same posture as UX-002 / UX-003
/ UX-004.

Resolved by PR #98: each phase cell is now `<a class="theia-phase-cell"
href="/phases/<n>">` with hover treatment via a CSS-variable trick
(`--phase-border` flips from `var(--rule)` to `var(--ink)` on hover,
working around the inline `border:` shorthand). New
`tools/theia/src/views/phase.ts` ships `renderPhaseDetail(n, state)`
showing phase title, milestone count, and the list of specs assigned
to that phase (each linked to `/specs/<slug>`). New route
`GET /phases/:n` in `server.ts`; unknown phase → 404 with the detail
view's "not found" page (HTML, mirrors the spec detail pattern).
11 new tests (6 view + 5 server, including 404 cases for non-numeric
and negative inputs).

---

## UX-006 — Spec detail task list renders as raw text; should be human-readable

**Status:** open
**Kind:** follow-up
**Source:** session-end note, 2026-06-23
**Affects:** tools/theia/src/views/spec.ts, tools/theia/src/views/layout.ts

After UX-003, the per-spec detail view enumerates every task from
`tasks.md` with `[x]` / `[ ]` and the text in one inline `<li>`.
On real specs the line is long and dense — e.g.:

> `[x] T-01 apps/atlas/ scaffolding: directory layout, package.json with workspace-only dependencies, assets/ for fonts, README.md (AC-4)`

The backticks around `apps/atlas/`, `package.json`, etc. are
HTML-escaped, so they render as literal backticks; `**bold**` inside
the text shows as literal asterisks; `(AC-N)` references show as
plain text. The whole `<li>` is on one line, so long tasks overflow
horizontally and are hard to scan.

**Goal.** Render each task as a small, scannable block:

1. **Two-line per task.** First line: `[x]` mark + the task id
   (e.g. `T-01`) as a badge. Second line: the task text, indented
   to align with the mark, with the text wrapped naturally.
2. **Inline code (`backticks`).** A small inline-markdown helper
   turns `` `…` `` into `<code>…</code>`. Scoped to the
   text field; the id and section headings are not processed.
3. **Bold (`**…**`).** Same helper handles `**bold**` → `<strong>`.
   `***bold-italic***` is out of scope.
4. **`(AC-N)` references.** Rendered as small styled pills
   (`<span class="theia-task-ac">AC-1</span>`) at the end of the
   line. Token-disciplined: `var(--neutral)` text on `var(--rule)`
   background, no raw colors.
5. **Done styling stays.** Strikethrough on the id and text; the
   mark stays in `--ok`. (UX-003 baseline preserved.)

**Layout sketch.**

```
[ ] T-01
    apps/atlas/ scaffolding: directory layout, package.json
    with workspace-only dependencies, assets/ for fonts,
    README.md                              (AC-4)
```

CSS-only — no JS, no extra tokens. The token linter still gates
raw colors / fonts / spacing scale.

**Implementation shape.**

- New `inlineMarkdownToHtml(text: string): string` helper in
  `tools/theia/src/views/spec.ts` (or co-located in tokens.ts if
  it ends up shared with the spec summary preview later). Scans
  the text for `` ` `` and `**` pairs, escapes the rest, returns
  HTML. Pure function, easy to unit-test.
- `renderTaskList` in `tools/theia/src/views/spec.ts` — switch
  the `<li>` from a single inline span to a small two-line block.
  Run the text through the helper. Extract `(AC-N)` matches
  before/after the markdown pass and wrap them in
  `<span class="theia-task-ac">`.
- `tools/theia/src/views/layout.ts` — minimal CSS for the new
  block layout, the AC pill, and the indentation.
- Tests: new file `tools/theia/tests/inline-markdown.test.ts` for
  the helper (backticks, bold, escapes, mixed), and 2–3 new
  tests in `tools/theia/tests/views.test.ts` for the rendered
  HTML shape (block layout, `<code>`, `<strong>`, AC pill).

**Out of scope.**

- Full markdown render (headings, lists, links). The text in
  `tasks.md` is intentionally light — backticks + bold covers
  the visible cases.
- Heading-style autodetection (`### `, `2. `, etc.) — the parser
  already captures `## ` and the fixture is canonical; widening
  to other heading depths is a separate concern.
- Click-to-toggle in the Theia detail view (no mutation; read-only
  by Spec 012 §7).

---

*Last updated: 2026-06-23 (UX-001 → done via PR #87, status flipped via PR #94; UX-004 → done via PR #96; UX-005 → done via PR #98; UX-006 added).*
