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

**Status:** open
**Kind:** churn
**Source:** session-end audit, 2026-06-22
**Affects:** origin (remote branches)

Remote branches whose PRs were merged but never deleted:

- `origin/013-atlas-demo-seeder` (merged via #73)
- `origin/074-atlas-ui-polish` (merged via #75)
- `origin/070-adr008-review-fixes` (merged via #69)
- `origin/070-docs-cleanup` (merged via #71)
- `origin/072-renumber-008-009` (merged via #72)
- `origin/075-spec012-theia-impl-pr7-npm-test-runner` (merged via #76)

Cleanup:

```
git remote prune origin         # safe — only drops refs already gone
# or, per branch:
git push origin --delete <branch>
```

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

*Last updated: 2026-06-22. Seeded with 4 items from the close-out of the
#73 / #75 session. Format designed for Theia parser consumption per
the contract above; the parser itself is a Spec 012 follow-up.*
