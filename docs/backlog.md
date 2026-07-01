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

**Status:** done
**Kind:** bug
**Source:** observed during PR #73 / #75 verification (pre-existing on main)
**Affects:** tools/theia/tests/parser-inventory-use-cases.test.ts
**Closed:** 2026-06-29 (fix landed in PR #88 on 2026-06-22; entry updated in PR #89)

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

**Resolution.** Fixed in PR #88 (`test(theia): expand repo-typical
fixture to satisfy AC-6 inventory assertion`, commit `ce84833`,
merged 2026-06-22T22:53:15Z). The fixture now ships with 3 apps
(`cli`, `atlas`, `theia`) plus a workspace package, satisfying the
`apps.length >= 3` assertion. PR #89 only updates the bookkeeping —
the fix itself is #88, per the same provenance rule applied to
TEST-001 (don't claim `done` for work done out-of-band).

**Verification.** `npm test` post-merge shows the AC-6 failure gone;
full suite at `1483cfb` passes 363/364, with the one remaining failure
(`AC-9: compliance panel renders obligations grouped by status with
totals` in `apps/atlas/tests/atlas-compliance-panel.test.ts:153`) being
pre-existing and unrelated — tracked separately if confirmed new.

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

## CHORE-003 — re-collecting zombies: post-#86 worktrees + post-#85 remote branches

**Status:** done
**Kind:** churn
**Source:** session-end audit, 2026-06-29
**Affects:** local worktrees + `origin` remote branches
**Closed:** 2026-06-29 (PR #89)

CHORE-002 closed the cleanup as "structurally unlikely to recur" — and the sibling-style `~/Proyectos/daedalus-*` worktrees it targeted did stop appearing, because sessions now use the in-repo `.worktrees/<slug>/` layout (ADR-008 §Amendment). But the new layout created a different shape of leak: **sessions that merge cleanly leave their `.worktrees/<slug>/` directory behind** unless the agent runs `git worktree remove` before closing the turn. CHORE-002 didn't cover that because at the time no in-repo worktree had yet been merged.

Similarly, CHORE-001 deleted 75 stale remote branches on 2026-06-22, but the next ~30 PRs (#86 → #102) each left a fresh `origin/<branch>` ref behind. So the cleanup pattern CHORE-001 → CHORE-002 established needs a periodic re-pass, not a one-shot.

Snapshot at the start of this session (`1483cfb` on `main`):

- **3 stale local worktrees** (all in-repo, all bound to merged branches, all clean):
  - `.worktrees/bug-001-theia-fixture-apps`     → `087-bug-001-theia-fixture-apps`   (PR #88 merged 2026-06-22)
  - `.worktrees/post-086-hygiene`               → `087-post-086-hygiene`             (PR #90 merged 2026-06-22)
  - `.worktrees/test-001-value-chain-cli-flake` → `088-test-001-value-chain-cli-flake` (PR #91 merged 2026-06-22)
- **6 stale remote branches** on `origin` (all merged, none with open PRs — verified with `git merge-base --is-ancestor origin/<b> origin/main` + `gh pr list --state open`):
  - `origin/069-amend-008-worktrees-in-repo`     (PR #69 merged)
  - `origin/085-chore-001-prune-stale-branches` (PR #85 merged)
  - `origin/086-ux-001-marquee-pause`           (PR #86 merged)
  - `origin/087-bug-001-theia-fixture-apps`     (PR #88 merged)
  - `origin/087-post-086-hygiene`               (PR #90 merged)
  - `origin/088-test-001-value-chain-cli-flake` (PR #91 merged)
- **6 stale local tracking branches** (one per remote above; `git branch -d` is safe because each tip is an ancestor of `main`).

**Resolution.** All 3 worktrees removed via `git worktree remove` from the main checkout. All 6 remote branches deleted via `git push origin --delete <branch>` (each deletion confirmed by GitHub's response line `[deleted] <branch>`). All 6 local tracking branches deleted via `git branch -d`. Final `git branch -a` shows only the active in-flight branches (`015-`, `016-`, `017-`, `081-`, `082-`, `089-`) + `main` + `origin/main` + `origin/HEAD`. The same session also closed BUG-001 (the unrelated fix having landed in PR #88).

**Follow-up.** This is the second time CHORE-001/002 cleanup has had to be re-run, which suggests a *recurring* cleanup is needed rather than ad-hoc. Candidates (any requires steward approval before adding):
- A session-end hook (e.g. `tools/scripts/new-session.sh` paired with a `close-session.sh`) that auto-removes the current session's worktree on a clean exit. ADR-008 §Amendment already mandates the in-repo layout; pairing it with auto-cleanup would close the leak structurally.
- A `tools/scripts/prune-merged-branches.sh` runnable on demand (and by a periodic GitHub Action) that mirrors CHORE-001's safety checks (open-PR guard + ancestor verification) but only deletes branches whose merge is ≥N days old, to avoid racing with post-merge housekeeping PRs.

Tracked here as a single observation; not committed to either follow-up without an explicit decision.

---

## CHORE-004 — local branches left behind by squash-merged PRs

**Status:** done
**Kind:** churn
**Source:** session-end audit, 2026-06-30
**Affects:** local tracking branches (no remote refs)
**Closed:** 2026-06-30 (PR #104)

A class of leak CHORE-001 and CHORE-003 didn't cover, because at the time no squash-merged PR had yet produced it: **local branches whose commits are not ancestors of `main`, but whose effective content already is.** This happens whenever a PR is merged via GitHub's "Squash and merge" button (now the project default — see PRs #80, #81, #82, #83, #84, #103). The squash creates a new commit on `main` carrying the same content, but the original commits on the head branch are *discarded* from `main`'s history. `git branch -d` correctly refuses to delete the local branch ("not fully merged") even though the content is preserved — only `git branch -D` (with evidence) is safe.

Snapshot at the start of this session (`8e8d195` on `main`, post PR #103 merge):

5 local branches, all with PRs merged and no `origin/<branch>` ref:

| Local branch | PR | Merged | `git diff main <branch> --shortstat` |
|---|---|---|---|
| `015-spec-file-convention` | #80 | 2026-06-22T16:30Z | 57 files, +572 / **-4416** |
| `016-platform-api` | #83 | 2026-06-22T18:39Z | 37 files, +101 / **-2492** |
| `017-athena-founder-cockpit` | #84 | 2026-06-22T19:03Z | 34 files, +75 / **-2478** |
| `081-spec-file-convention-impl` | #81 | 2026-06-22T17:30Z | 38 files, +75 / **-3116** |
| `082-spec015-t28-closure` | #82 | 2026-06-22T18:45Z | 37 files, +74 / **-3115** |

Each branch is **~8 days stale** (last commit 2026-06-22). The high deletion counts are not merge conflicts — they are code that was *added to `main` after* the PR landed (test expansion, parser hardening, Theia UI work — see PRs #85–#103). The branches never rebased; their base has drifted.

**Safety verification (per branch, before delete):**

1. PR status verified as `MERGED` via `gh pr view <n>`.
2. `git diff main <branch> --numstat` was filtered for files with `+unique` (insertions with no corresponding deletions in the same file): **zero matches across all 5 branches.** Every file that has additions also has deletions, meaning every change is either (a) a partial edit within a file `main` also edited, or (b) an insertion into a file that `main` later expanded. No file is wholly unique to the branch.
3. Therefore the squash-merged content is provably present in `main`'s working tree (modulo the post-merge drift, which is `main` being *ahead* — never behind).

**Resolution.** All 5 local branches deleted via `git branch -D` after the evidence above. The deletion targets (the *git branches*) are **not the same objects as the spec directories** — `specs/015-spec-file-convention/`, `specs/016-platform-api/`, `specs/017-athena-founder-cockpit/`, etc. live in `main` as tracked files regardless of this cleanup; only the corresponding branch refs (e.g. `015-spec-file-convention`) are gone. Post-cleanup `git branch -a` will show only `main` and the current session's worktree branch plus `origin/main` / `origin/HEAD`. No new spec, plan, ADR, or code file is lost.

**On the follow-ups left open by CHORE-003.** This is now the *third* cleanup wave (CHORE-002 → CHORE-003 → CHORE-004), and the two structural candidates proposed at the end of CHORE-003 (session-end hook + periodic Action) remain unimplemented. Promoting those to committed backlog items is overdue; tracked here as the explicit pointer for whoever picks it up.

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

**Status:** done
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

Resolved by PR #100. Each task is now a two-line block: `[x] T-01`
on line 1, the prose on line 2 (indented). Inline `` `code` ``
becomes `<code>`, `**bold**` becomes `<strong>`, and `(AC-N[, AC-M])`
references are extracted and rendered as small styled pills at the
end. Done styling preserved: strikethrough on the whole block, the
mark stays non-struck in `--ok`. New `inlineMarkdownToHtml` helper
in `tools/theia/src/views/spec.ts` (pure, two-pass with placeholders
so code inside bold renders correctly). Fixture tasks.md updated
to a real shape (backticks, bold, AC refs) so the feature is
testable end-to-end. 15 new tests (10 inline-markdown + 5 view).

---

## UX-007 — Spec detail page needs polish: done styling, summary markdown, plan refs

**Status:** done
**Kind:** follow-up
**Source:** session-end note, 2026-06-23
**Affects:** tools/theia/src/views/spec.ts, tools/theia/src/views/layout.ts, tools/theia/src/parser/specs.ts

Looking at the live `/specs/015-spec-file-convention` page (a fully
shipped spec: 28/28 tasks done), the post-UX-006 rendering has three
visible problems:

1. **Strikethrough overwhelms a fully-done spec.** The CSS rule
   `.theia-task-done { text-decoration: line-through; }` applies to
   the whole `<li>`, so on a spec where every task is done (the common
   case once a spec is Ratified), the *entire page body* is rendered
   struck through — mark, id, text body, the inline `<code>` spans,
   the `(plan §N)` references. The page looks like a graveyard and
   is hard to scan. Fix: keep strikethrough on the **identity** (the
   `[x]` mark + the `T-NN` id) as a clear "done" signal, and **dim**
   the body text instead (color: `var(--neutral)`, no strikethrough).
   The mark stays in `--ok`. The AC pills stay normal-weight.

2. **Summary preview shows raw markdown.** Line 136 of the rendered
   HTML: `<p>... has **drift** between how specs ... [Spec 012 (Theia)](../012-theia/spec.md) can mechanically read ...</p>`. The
   summary is rendered with `escapeHtml(card.summaryPreview)` so
   backticks, bold, and links all show as literal characters. Fix:
   run the summary through the existing `inlineMarkdownToHtml`
   helper (extended to also recognise `[text](url)` links — small
   addition to the helper). The summary becomes `<p>... has
   <strong>drift</strong> ... <a href="../012-theia/spec.md">Spec 012
   (Theia)</a> can ...</p>`.

3. **`(plan §N)` references are plain text.** The current rendering
   leaves them inline at the end of the task text with no styling.
   They're not as semantically important as `(AC-N)` (the latter is
   the spec's acceptance criteria; the former is just a section
   pointer) so they shouldn't compete visually. Fix: render them as
   a small muted label (e.g. `§1` in `var(--neutral)` mono) without
   the parens, at the end of the line. Or: keep them as plain text
   in a slightly muted color. Easy to defer if the touch feels
   off — the primary fix is #1 + #2.

**Out of scope.**

- Click-to-toggle in the Theia detail view (read-only by Spec 012 §7).
- Per-task anchor links (`/specs/<slug>#T-01`).
- New parser changes. `card.summaryPreview` is the same string the
  parser already extracts; UX-007 only changes how the view renders
  it.

**Implementation shape (sketch).**

- `tools/theia/src/views/spec.ts`:
  - `inlineMarkdownToHtml` gets a third pass for `[text](url)` →
    `<a href="...">text</a>` (URLs are HTML-escaped; the link
    text goes through the existing escape). External vs internal
    is a href-prefix check, no special rendering.
  - `renderSpecDetail` runs `card.summaryPreview` through the
    extended helper.
  - `renderTaskText` (the per-task helper from UX-006) runs the
    prose through the extended helper. It also extracts `(plan
    §N[, plan §M, ...])` groups and renders them as small muted
    labels.
- `tools/theia/src/views/layout.ts`:
  - `.theia-task-done` changes from `text-decoration: line-through`
    to `color: var(--neutral)`.
  - The mark and id keep strikethrough via a targeted rule:
    `.theia-task-done .theia-task-mark, .theia-task-done .theia-task-line1 code { text-decoration: line-through; }`.
  - New `.theia-plan-ref` rule for the section reference label.
- Tests:
  - `inline-markdown.test.ts` gets new cases for `[text](url)`.
  - `views.test.ts` gets new assertions: summary contains
    `<strong>` + `<a>` (not raw `**` / `[`); done body is not
    struck through; `(plan §N)` shows as a label, not raw text.
- Fixture: not strictly required (the live repo's
  `015-spec-file-convention` exercises all three cases; the tests
  use the live renderSpecDetail path). Optional: extend the
  fixture's `spec.md` summary to include a link + bold so the
  test stays self-contained.

Resolved by PR #102. Three changes:

1. **Done styling is no longer overwhelming.** `.theia-task-done`
   now sets `color: var(--neutral)` (no strikethrough). A targeted
   rule strikes through the id (`.theia-task-done .theia-task-line1
   code`) so the `[x]` mark + the `T-NN` id remain the visual
   "done" signal; the body just dims. The mark stays in `--ok`; the
   AC pills and section-ref labels stay normal-weight.

2. **Summary runs through the inline-markdown helper.** `card.summaryPreview`
   is now passed through `inlineMarkdownToHtml`, so `` `code` ``
   becomes `<code>`, `**bold**` becomes `<strong>`, and
   `[text](url)` becomes `<a>`. Helper extended with a third pass
   for links: `[text](url)` → `<a>`, with the link text recursively
   processed so inline `**bold**` / `` `code` `` inside the link
   render correctly. URLs with dangerous schemes (`javascript:`,
   `data:`, `vbscript:`, `file:`) are silently rejected — only the
   text is kept, the URL is dropped.

3. **`(spec|plan §N[-M])` refs render as a small label.** The view
   now extracts paren groups that contain a section ref + AC refs
   in any order, e.g. `(spec §1-§4, AC-4)` produces BOTH a
   `spec §1–4` label and an `AC-4` pill. The range is normalised
   to use an en-dash (`1-§4` → `1–4`). The class was renamed from
   `.theia-plan-ref` to `.theia-section-ref` since it covers both
   `spec` and `plan` prefixes.

- views/spec.ts: renderSpecDetail now calls inlineMarkdownToHtml
  on the summary. renderTaskText now extracts AC + section refs
  in a single pass per paren group. inlineMarkdownToHtml extended
  with the link pass + safe-URL guard.
- views/layout.ts: .theia-task-done no longer strikes through
  body; the targeted id-strikethrough rule is added.
  .theia-section-ref class added (mono, neutral, no background —
  distinct from .theia-task-ac pills).
- tests/inline-markdown.test.ts: 6 new tests covering the link
  pass + safe-URL guard.
- tests/views.test.ts: 4 new tests for the three fixes
  (done styling, summary, section refs).
- tests/fixtures/.../001-ratified-p2/spec.md: updated summary
  to include `**bold**` + a `[link](url)` so the new helper is
  exercised.
- tests/fixtures/.../001-ratified-p2/tasks.md: updated to include
  `(spec §N-M, AC-N)` groups so the paren-grouped extraction
  is exercised.

364/364 tests pass; token linter (AC-11) and no-platform-imports
linter (AC-15) both green.

---

## UX-008 — Overview polish + accessibility hygiene (Theia)

**Status:** done
**Kind:** follow-up
**Source:** founder audit of http://127.0.0.1:8789 on 2026-06-30
**Affects:** tools/theia/src/views/overview.ts, tools/theia/src/views/spec.ts, tools/theia/src/views/layout.ts, tools/theia/src/views/tokens.ts, .gitignore, tools/theia/tests/fixtures/repo-typical/docs/backlog.md, tools/theia/tests/fixtures/repo-typical/tests/

### Scope

Cohesive polish pass over the Theia overview + spec detail + layout, plus
accessibility hygiene borrowed from the ui-ux-pro-max skill's pre-delivery
checklist (the items that align with the Daedalus canon — not its dark-mode
or Fira-font recommendations, which conflict with Spec 012 §1, §7 and AC-11).
One PR, **commits separated by concern** so the slice can be split later if
the review wants.

### P0 — real bugs / weakest links

1. **Spec detail "Spec file" link points to a GitHub search URL, not the
   blob.** `views/spec.ts:24` builds
   `github.com/search?q=repo%3Ahugomoraga%2Fdaedalus+path%3Aspecs/…`.
   Should be
   `github.com/hugomoraga/daedalus/blob/main/specs/…`. Trivial fix,
   real bug.

2. **Overview section order has no hierarchy.** All ten sections
   (Phases, Specs, Drift, ADRs, Backlog, Code, CLI, Tests, Diff,
   Blockers) sit at the same weight. Reorder by usefulness for a
   founder opening the page: Drift → Specs → Tests → Blockers →
   ADRs → Backlog → Phases → Diff → Code → CLI. Add `id="…"` to each
   section heading so a future jump-nav (UX-009+) can deep-link
   without a layout change. **No CSS layout change in UX-008.**

### P1 — consistency + scannability

3. **Backlog body shows raw markdown.** `views/overview.ts:160` runs
   the body through `escapeHtml`, so `**bold**`, `` `code` ``, and
   `[link](url)` appear as literal characters. Inconsistent with the
   spec detail page (which uses `inlineMarkdownToHtml` since UX-007).
   Fix: run `b.body` through the same helper. Two-line view change.

4. **CLI commands listed flat (47 entries).** `renderUseCasesSection`
   dumps a single `<ul>`. Group by the colon-prefix
   (`revenue:*`, `proposal:*`, `lead:*`, `opportunity:*`, `invoice:*`,
   `obligations:*`, `project:*`, `expense:*`, `rules:*`,
   `human:*`, `payment:*`). Each group renders under an `<h4>` with
   the prefix label and a count. Use the existing
   `inlineMarkdownToHtml` not relevant here; the implementation is a
   `Map<string, string[]>` group + a `for…of` over sorted prefixes.

5. **Code inventory entries are not clickable.** `renderCodeInventorySection`
   wraps each entry as `<li><code>name</code></li>`. Atlas Spec 007
   AC-6 says "with a clickable link". Wire each entry:
   - `app` / `package` → `https://github.com/hugomoraga/daedalus/tree/main/<kind>s/<name>`
     (raw GitHub directory URL — no platform import).
   - `test` → the file under
     `https://github.com/hugomoraga/daedalus/blob/main/tests/<name>`
     (matching the link pattern from P0-2).

6. **Spec detail for a fully-done spec shows only a progress bar.**
   On `/specs/015-spec-file-convention` (28/28 done) the founder
   has to scroll through 28 individual `[x] T-NN` items before
   finding anything. Add a one-line summary at the top
   (under the existing progress row) when
   `done === total && total > 0`:
   `"8 PRs · 32/32 tasks done · Ratified Phase 2 · v1.0.0"`.
   The "PRs" count is the number of `## PR N — …` sections in
   the parsed `taskList`.

7. **Diff + Blockers sections render even when empty.** On `main`
   the overview shows
   `"Diff (branch main) · 0 files · +0 / -0 · No commits ahead of main."`
   and
   `"Blockers + next unlocks · No specs currently blocked."`
   — both take vertical space and tell the user nothing. Render
   only when there is something to say: Diff when `d.commits.length > 0`
   OR `d.filesChanged > 0`; Blockers when `state.blockers.length > 0`
   OR `state.nextUnlocks.length > 0`.

### P2 — header polish

8. **`.brand` class has no CSS.** `<div class="brand">Theia<small>…</small></div>`
   inherits the body font, so the word "Theia" has no visual
   identity. Add a small rule in `views/layout.ts`:
   `font-family: var(--display); font-size: 18px; letter-spacing: -0.02em;`
   on `.brand`, and `color: var(--neutral); font-size: 12px; margin-left: 4px;`
   on `.brand small`.

### P3 — accessibility hygiene (from ui-ux-pro-max checklist, items aligned with canon)

The skill's pre-delivery checklist suggests dark mode, Fira fonts, and
Google Fonts CDN — all of which conflict with Spec 012 (Atlas-token
reuse, no new design system, no external network). What does align,
and what UX-008 adopts:

9. **Hover transitions (150–300ms ease).** Atlas interactive
   elements (`theia-card-link`, `theia-phase-cell`, `theia-task-ac`)
   snap to a new border-color on hover, with no transition. Add
   `transition: border-color 200ms ease` (or color-shorthand for
   elements that change color). Token-disciplined: no raw values.

10. **`prefers-reduced-motion: reduce` media query.** The Navigate
    marquee (Spec 007 v1.3, also reused in Theia's own layout.css
    if any) animates for 40s. For users with `reduce`, the marquee
    must stop. Add a single `@media (prefers-reduced-motion: reduce)`
    rule in `views/layout.ts` that sets `animation-play-state: paused`
    on the marquee track and `transition-duration: 0s` on
    interactive elements. Does **not** affect Theia's own animations
    (there are none today), but future-proofs the layout file.

11. **`:focus-visible` styling for keyboard nav.** `<a>` elements
    inherit the browser default (varies). Add a global rule:
    `a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.
    Token-disciplined.

12. **Contrast acceptance criteria.** Verified all Atlas color
    pairs against WCAG 4.5:1:
    - `--neutral` on `--paper`: 4.97:1 (AA ✓)
    - `--neutral` on `--card`:  5.19:1 (AA ✓)
    - `--ink`     on `--paper`: 17.35:1 (AAA ✓)
    - `--accent`  on `--paper`: 4.70:1 (AA ✓)
    - `--ok`      on `--paper`: 5.45:1 (AA ✓)
    - `--warn`    on `--paper`: 4.61:1 (AA ✓)
    - `--alert`   on `--paper`: 6.80:1 (AA ✓)
    Add a one-liner to Spec 012's AC-11 (or a new AC-16 in
    `specs/012-theia/spec.md`) so the pass is explicit and the
    linter or a future a11y test can re-verify.

### `.gitignore` — `.opencode/` is NOT ignored today

The ui-ux-pro-max skill installed 147 files / 2.9 MB to
`.opencode/skills/`. The current `.gitignore` only covers `.data/`,
`.worktrees/`, and `node_modules/`. Without an entry, a careless
`git add .` from main would commit the entire skill to the repo.
**UX-008 adds `.opencode/` to `.gitignore` as the first commit.**

### Out of scope

- **Dark mode** for Theia (would require a parallel palette in
  `apps/atlas/src/tokens.ts` — its own spec, e.g. Spec 018).
- **Typography change** (Inter Tight / Inter / JetBrains Mono
  are the canonical trio per Atlas AC-11; Fira would break the
  linter).
- **External icon library** (Heroicons / Phosphor — adds deps,
  forbidden by Spec 012 §7).
- **CSS layout change to a 2-column overview** (UX-009 territory
  if wanted; UX-008 only reorders and adds IDs).
- **Editing the backlog from Theia** (read-only by Spec 012 §7).
- **Per-task anchor links** (UX-009 territory).

### Acceptance

- `npm test` stays green (364 → 364+N where N = tests added).
- Theia token linter (AC-11) stays green — no raw color, font, or
  spacing outside the canonical scales.
- Theia no-platform-imports linter (AC-15) stays green.
- Live `curl http://127.0.0.1:8789/` renders the reordered overview;
  section headings carry `id="…"` so
  `curl http://127.0.0.1:8789/#blockers` would deep-link
  (anchor support itself is browser-native; UX-008 just adds the
  targets).

---

*Last updated: 2026-06-23 (UX-001 → done via PR #87, status flipped via PR #94; UX-004 → done via PR #96; UX-005 → done via PR #98; UX-006 → done via PR #100; UX-007 → done via PR #102).*
*2026-06-30: UX-008 added (in-progress, audit-driven). UX-008 → done via this PR (worktree `093-theia-ux-008-polish`).*

### UX-008 — Resolution

Resolved by PR (this branch — `093-theia-ux-008-polish`).

**Ten commits, one PR (separated by concern).** Files touched:

- `.gitignore` — adds `.opencode/` (skill data, never commit)
- `tools/theia/src/views/tokens.ts` — exports `GITHUB_REPO`
- `tools/theia/src/views/spec.ts` — uses `GITHUB_REPO`; adds the
  fully-done summary line; renders the summary through
  `inlineMarkdownToHtml`
- `tools/theia/src/views/overview.ts` — section reordering; section
  ids; backlog body markdown; CLI grouped by prefix; code inventory
  links; hidden Diff/Blockers when empty
- `tools/theia/src/views/layout.ts` — `.brand` styles; hover
  transitions; `:focus-visible`; `prefers-reduced-motion` query
- `tools/theia/tests/views.test.ts` — 13 new tests
- `tools/theia/tests/fixtures/repo-typical/docs/backlog.md` — fixture
  body now exercises bold / code / link through the helper
- `tools/theia/tests/fixtures/repo-typical/tests/` — adds a sample
  `.test.ts` so the code-inventory `/blob/main/tests/` path is
  exercised

**Acceptance:** `node --test tools/theia/tests/*.test.ts` →
164/164 pass (was 153 before this PR). Theia token linter (AC-11)
and no-platform-imports linter (AC-15) both green.

**Live verification** at `http://127.0.0.1:8789/`:

- `/` renders the new section order: drift → specs → tests →
  blockers (hidden when empty) → adrs → backlog → phases → diff
  (hidden on main) → code → cli. Section headings carry `id="…"`
  so `#specs`, `#tests`, etc. are browser-resolvable.
- `/specs/012-theia` — the "Spec file" link now goes to the GitHub
  blob URL directly (was a search URL).
- `/specs/015-spec-file-convention` — the fully-done summary line
  appears right under the progress bar: "X PRs · N/N tasks done ·
  Ratified Phase 2 · v1.0.0".
- Backlog rows now render `**bold**`, `` `code` ``, and `[link](url)`
  as proper HTML (was literal characters).

**Explicitly NOT adopted from the ui-ux-pro-max skill** (per the
audit + UX-008 entry body):

- Dark mode OLED palette — conflicts with Spec 012 §1 (Atlas
  visual tokens, no new design system).
- Fira Code / Fira Sans — outside the canonical typography trio
  per Atlas AC-11.
- Google Fonts `@import url(...)` — conflicts with Spec 012 §7
  (no external network, no CDN).
- Heroicons / Phosphor — would add runtime deps, conflicts with
  Spec 012 §7.
- 2-column overview layout — UX-009 territory; UX-008 only
  reorders + adds ids.

**Follow-ups tracked separately (UX-009+ candidates):**

- 2-column overview with sticky left nav (now trivial since
  section ids are in place).
- Breadcrumb on spec / phase detail pages.
- "Recently" section — events parsed from git log + changelog
  inferred from spec status transitions.
- Tests panel breakdown by file + recent failure history.
- Color tone parity on phase-cell (currently solid `--accent`
  when active; consider an outline-only variant if the founder
  prefers quieter).

## UX-009 — Backlog section: hide done by default, fix markdown rendering, compact rows

**Status:** in-progress
**Kind:** follow-up
**Source:** founder observation on 2026-07-01 ("la sección de backlog se ve mal" while reviewing the UX-008 merge at http://127.0.0.1:8789/)
**Affects:** tools/theia/src/views/overview.ts, tools/theia/src/views/spec.ts, tools/theia/tests/views.test.ts, tools/theia/tests/inline-markdown.test.ts, tools/theia/tests/fixtures/repo-typical/docs/backlog.md

### Why

The Theia backlog section (`/`, the section under `<h3>Backlog (N)</h3>`)
has three visible problems that show up the moment you scroll past the
spec grid:

1. **Done entries dominate the page.** 13 of 14 backlog entries are
   `done` (historical). The founder opens the page looking for *what to
   do next* and instead scrolls past 13 rows of historical context.
   UX-009 hides the `done` group behind a `<details>` summary by
   default; the working states (`open`, `in-progress`, `wontfix`) stay
   visible.

2. **Markdown rendering is incomplete.** `inlineMarkdownToHtml` (UX-007)
   handles only inline backticks, bold, and links. The backlog bodies
   routinely use **fenced code blocks** (`` ``` ... ``` ``),
   **tables** (`| col | col |`), and **lists** (`- item`). These render
   as literal characters or, worse, as one big inline `<code>` (the
   triple-backtick case in BUG-001 and TEST-001 bodies). UX-009 adds
   three pre-passes for the block-level markers so the bodies render
   the way the author wrote them. Spec 012 §7 forbids external markdown
   libraries (zero runtime deps); the helper grows in place.

3. **Each row is ~3-4 lines tall** with `padding: 4px 8px` and the
   "affects" line below the title. 14 rows × 4 lines = ~60 lines
   before the user reaches the end of the section. UX-009 tightens
   the row to a denser card-like layout and trims the visual noise.

### Scope (one PR, three concerns separated as commits)

**Concern 1 — hide done by default (overview.ts).** The render loop
already groups by status in a fixed order
(`open` → `in-progress` → `wontfix` → `done`); UX-009 wraps the
`done` group's `<h4>` + `<table>` in a single `<details>` element
whose summary reads "Show N done entries". The three working-state
groups render unchanged. The `<details>` is **open by default** when
the URL carries `?show=done` so a deep link from a steward review
can still land on the full view. Net change: ~20 lines in
`renderBacklogSection`, no view contract change.

**Concern 2 — block-level markdown in the inline helper (spec.ts).**
`inlineMarkdownToHtml` grows three pre-passes, all of which use the
same placeholder mechanism as the existing passes so nesting still
works:

  - **Fenced code blocks** `` ```lang\n...\n``` `` →
    `<pre><code class="theia-code-block">…</code></pre>`. Indentation
    inside the block is preserved; HTML is escaped per line; the
    language hint is dropped (token-disciplined — no extra class per
    language). Unbalanced `` ``` `` is treated as literal text (same
    policy as unbalanced `**`).
  - **Tables** `| h1 | h2 |\n| --- | --- |\n| a | b |` →
    `<table class="theia-md-table"><thead>…</thead><tbody>…</tbody></table>`.
    Header row detected by the separator line (`| --- |`). Cells
    run through the existing inline passes (so `**bold**` and
    `` `code` `` inside a cell work). GFM-style alignment
    (`:---:`) is parsed and emitted as `text-align` on the cell
    (token-disciplined via a CSS class, not an inline style).
  - **Lists** lines that start with `- `, `* `, or a digit followed
    by `. ` → `<ul>` or `<ol>`. Nested lists (2-space indent) are
    supported up to three levels. Empty lines separate list blocks
    from prose. Inline passes run on each item's text.

The new passes run *before* the existing link/code/bold passes so
that the inline helpers don't have to know about block structure.
Safe-URL guard for links (UX-007) is unchanged.

**Concern 3 — compact row layout (layout.ts).** Add three
token-disciplined rules:

  - `.theia-backlog-row td` padding `8px 12px` (was `4px 8px`); the
    row gets a hairline top border (`var(--rule)`) instead of the
    default `<table>` border.
  - `.theia-backlog-row .theia-md-table` margin `8px 0` and a
    smaller mono font for cells; padding `4px 8px`.
  - `.theia-backlog-row pre.theia-code-block` margin `8px 0`,
    background `var(--card)`, padding `8px 12px`, border-left
    `2px solid var(--neutral)` (the canonical "code block" rule
    the rest of the platform uses).

The `padding: 4px 8px` on backlog rows was the only place in Theia
that used that 4-px-tall padding; the spec cards use 16px, the
phase cells use 8px, the AC pills use 4px-on-8px. The new 8/12 sits
between the spec card and the AC pill, which is correct for a
table row.

### Out of scope

- **Re-grouping the backlog** by kind (`bug` / `follow-up` / `churn`)
  instead of by status. The current `open` → `in-progress` →
  `wontfix` → `done` order is the right working-state order. A
  per-kind view would be a follow-up if the founder wants it.
- **Per-row action buttons** ("Edit", "Mark done", "Reopen").
  Read-only by Spec 012 §7.
- **Inline editing of the body** — same reason.
- **A real markdown parser** (`marked`, `markdown-it`, …). Spec 012
  §7 forbids it; the block-level passes cover the cases that
  actually appear in backlog bodies (verified against the 14
  existing entries + the fixture).
- **Inline HTML in backlog bodies** — the helper still HTML-escapes
  everything outside the placeholder slots. The body is not a
  trusted surface; this stays strict.

### Acceptance

- `npm test` → 384 + N pass, where N is the new tests for the
  three block-level passes + the filter behavior.
- Token linter (AC-11) and no-platform-imports linter (AC-15)
  both green. The new CSS rules are token-disciplined; the new
  HTML uses no raw colors or fonts.
- Live `curl http://127.0.0.1:8789/`:
  - The Backlog section shows `open` / `in-progress` / `wontfix`
    rows expanded.
  - The `done` group is collapsed behind a "Show 13 done
    entries" summary.
  - The BUG-001 body's code block (`` ```not ok 213…``` ``) renders
    as a `<pre><code>` block (not as one big inline `<code>`).
  - The CHORE-004 body's pipe-table renders as a real `<table>`
    (not as literal pipes).
  - The CHORE-002 body's bullet list (`- daedalus-athena-…`) renders
    as a real `<ul><li>` (not as literal `-` characters).
  - The TEST-001 body's prose, including `` `code` `` spans, still
    renders correctly (no regression on the existing inline
    passes).
- Deep link `?show=done` opens the `done` group for reviewers
  who want the full view.

## UX-010 — Backlog section: card list restructure (badges inline + affects truncated)

**Status:** in-progress
**Kind:** follow-up
**Source:** founder observation on 2026-07-01 ("Mejoro pero aun se ve extraño" while reviewing the UX-009 merge at http://127.0.0.1:8789/)
**Affects:** tools/theia/src/views/overview.ts, tools/theia/src/views/layout.ts, tools/theia/tests/views.test.ts

### Why

UX-009 fixed three things on the backlog section: hidden the
"done" group, fixed the broken markdown rendering, and tightened
the row padding. It did **not** address a visual hierarchy
problem: the row used a 3-column `<table>` (id | kind | cell),
so the badges landed in the leftmost columns while the title
and affects were in the rightmost column. When the affects
path was long (the live UX-009 entry lists 5 paths), the
title cell wrapped to 3+ lines, leaving the badges visually
orphaned at the top of a tall row with whitespace in between.

UX-010 replaces the table with a card list (matching the
spec card pattern) and puts the badges **inline** with the
title. Each entry becomes:

```
[UX-009] [FOLLOW-UP] Backlog section: hide done by default, fix markdown rendering, compact rows
   affects: tools/theia/src/views/overview.ts  +4 more
   ▸ context
```

Three lines per entry, no orphan badges.

### Scope (one PR, two commits)

**Concern 1 — restructure to a card list (`overview.ts` +
`layout.ts`).** Replace `<table class="theia-backlog-table">`
with `<ul class="theia-backlog-list">` of `<li class="theia-backlog-item">`.
Each item:

  - **Line 1** (header): the id badge + kind badge inline with
    the title. The title is `<strong>`; the badges use the
    existing `tag()` helper. The badges sit on the same
    horizontal line as the title, so the visual hierarchy
    reads "this entry, with these tags, is about X".
  - **Line 2** (meta): the affects line. If the affects is a
    single path, show it as-is. If the affects has multiple
    comma-separated paths, show the first + `+N more` where N
    is the count of the others (e.g. `+4 more`).
  - **Line 3** (body): the `<details>` summary "▸ context" and
    the rendered body when expanded. Unchanged from UX-009.

**Concern 2 — affects truncation (`overview.ts`).** The current
`affects` field is a single string captured by the parser.
The view splits on `,`, trims each item, and truncates. The
parser contract is unchanged — affects remains `string | null`.
The truncation is a view-layer concern.

Truncation rule: if the comma-separated list has 1 item, show
it as-is. If 2+, show the first + `+N more` (e.g.
`tools/theia/src/views/overview.ts +4 more`). The total
count is preserved in the title attribute of the `<code>`
wrapping the truncated list, so the founder can hover to see
the full list (UX-007's safe-URL guard already covers
this — the code block contains literal paths, not URLs).

If the comma-separated list has 1 item, the truncation is a
no-op. The 14 live entries: 13 have 1 path, 1 has 5
(UX-009). The truncation only kicks in for multi-path
entries.

### Out of scope

- **Markdown inside the affects line** — the affects is
  rendered as `<code>` with the path text HTML-escaped, not
  through `inlineMarkdownToHtml`. The current behavior is
  intentional (paths should look like paths, not like
  prose). Truncation is the only change.
- **Per-row "open" / "reopen" actions** — read-only by
  Spec 012 §7.
- **Inline editing of the body** — same reason.
- **Capturing affects as `string[]` in the parser** — the
  parser contract is unchanged. View-layer truncation keeps
  the parser pure and the contract stable.
- **Re-grouping by kind** — the current
  `open` → `in-progress` → `wontfix` → `done` order is the
  right working-state order.

### Acceptance

- `npm test` → 402 + N pass, where N is the new tests for
  the card-list structure and the affects-truncation rule.
- Token linter (AC-11) and no-platform-imports linter
  (AC-15) both green.
- Live `curl http://127.0.0.1:8789/`:
  - The Backlog section renders a `<ul class="theia-backlog-list">`
    with one `<li>` per entry, instead of a `<table>`.
  - Each entry shows id + kind badges inline with the title.
  - The 5-path UX-009 affects renders as
    `tools/theia/src/views/overview.ts +4 more`.
  - The 1-path entries render their full path.
  - The done group is still collapsed by default;
    `?show=done` still opens it.
  - The body (block-level markdown from UX-009) still
    renders correctly inside the details.
