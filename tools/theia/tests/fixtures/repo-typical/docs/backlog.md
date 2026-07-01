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

The body exercises **bold**, `inline code`, and a
[link to the spec](specs/001-ratified-p2/spec.md) so the
overview view (UX-008 P1-1) can prove the inline-markdown
helper renders the body and does not leak raw `**` / `` ` ``
characters.

---

## UX-002 — fixture UX entry (done)

**Status:** done
**Kind:** follow-up
**Source:** fixture

A fixture entry without an Affects field. Used to verify the
optional field is null when absent.
