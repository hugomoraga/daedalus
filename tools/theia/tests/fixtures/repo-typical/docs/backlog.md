# Daedalus Backlog (fixture)

> Fixture for Theia parser tests. Not the real backlog.

---

## BUG-001 — fixture bug entry

**Status:** open
**Kind:** bug
**Source:** fixture
**Affects:** tools/theia/

The fixture's BUG-001 entry. Used to verify the parser pulls
every required field plus the body.

---

## UX-001 — fixture UX entry (in-progress)

**Status:** in-progress
**Kind:** follow-up
**Source:** fixture
**Affects:** apps/atlas/src/

A fixture entry with an Affects field. Used to verify the
optional field is captured when present.

### Why

The body exercises **bold**, `inline code`, a
[link to the spec](specs/001-ratified-p2/spec.md), a fenced
code block, a bullet list, and a small table so the overview
view (UX-008 P1-1 + UX-009 + UX-011) can prove the inline +
block markdown passes render the body correctly and do not
leak raw `**` / `` ` `` characters.

The block-level markers are wrapped in ATX headers (UX-011)
so the parser + view tests catch regressions on the heading
pre-pass.

```bash
not ok 213 - AC-6: parseCodeInventory
AssertionError: false == true
```

Branches cleaned:

- `origin/087-bug-001`
- `origin/087-post-086-hygiene`

| branch | merged |
| --- | --- |
| a | yes |
| b | no |

---

### Acceptance

Tests stay green; the affected surface (`apps/atlas/src/`)
keeps its existing visual discipline.

---

## UX-002 — fixture UX entry (done)

**Status:** done
**Kind:** follow-up
**Source:** fixture

A fixture entry without an Affects field. Used to verify the
optional field is null when absent.
