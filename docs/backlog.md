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

**Status:** open
**Kind:** bug
**Source:** intermittent across multiple test runs in #73 / #75 sessions
**Affects:** apps/cli/tests/value-chain-cli.test.ts

The test that walks Lead → Payment with a human gate at `paid → closed`
fails intermittently. ~440 ms when it passes; crashes almost
immediately when it fails. The shape of the failure suggests timing
sensitivity in how the test sets up the workflow instance or awaits
its projection. Pre-existing on main — not introduced by recent work.

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

**Status:** open
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

---

*Last updated: 2026-06-22 (CHORE-001 → done via PR #85; CHORE-002 added → done after PR #86 amendment merged and sibling worktrees removed).*
