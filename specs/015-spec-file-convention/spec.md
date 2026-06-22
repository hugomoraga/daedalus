# Spec 015 — Spec File Convention

**Status:** Draft · Tooling-adjacent · not a platform capability (not on the [Roadmap](../../docs/roadmap.md))
**Type:** Process + tooling convention · consumed by [Spec 012 — Theia](../012-theia/spec.md)
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). Codifies a single convention for `tasks.md` so Theia can accurately report per-spec completion, and so future specs cannot drift silently.

> **Scope.** Process + tooling — not a platform capability. Lives in `specs/015-…/`, references `tools/theia/` artefacts, never imports platform code.

---

## 1. Summary

The repository has **drift** between how specs declare tasks and what [Spec 012 (Theia)](../012-theia/spec.md) can mechanically read. Out of 15 specs, only 2 use `- [x] / - [ ]` checkboxes — the rest use table rows with `| ✅ |` status emojis, and 2 specs have no `tasks.md` at all. Theia shows all of those as `0 / 0 tasks`, even when shipped. This is a real correctness problem: the spec progress reported by Theia does not match reality for 13 of 15 specs.

This spec fixes the drift by:

1. fixing **one canonical format** for `tasks.md` — markdown checkboxes (`- [x]` / `- [ ]`), one line per task;
2. **extending the parser defensively** to recognise the legacy emoji-table form so existing shipped specs stop reporting `0 / 0` *during the migration window*, even before they're rewritten;
3. shipping a **convention linter** that fails `npm test` when any spec violates the format;
4. shipping a **Theia drift widget** that surfaces non-conforming specs without forcing a restart;
5. **migrating all 15 existing specs** to the canonical format in a single PR.

After this spec ships, every spec carries machine-consumable completion data, Theia's per-spec counts are accurate, and a new spec that violates the format fails CI instead of silently misreporting.

---

## 2. Relation to the canon

| Reference | Relation |
|---|---|
| **Constitution** | Obeys all ten principles as applicable to a tooling/process change. Key: *Spec-Driven Development* (this spec); *Simplicity First* (one format, one regex, no schema); *Auditability by Default* (machine-readable completion data); *Modular Evolution* (the convention isolates the consumer from spec authors — neither knows about the other's specifics). |
| **Technical Principles** | Reuses the existing `tools/` convention ([ADR-007](../../governance/decisions/ADR-007-theia-as-tools-directory.md)). Adds `tools/theia/CONVENTIONS.md` and `tools/scripts/check-spec-conventions.mjs`; no new package. |
| **Spec 012 (Theia)** | This spec is the **input contract** for the consumer defined in Theia §4. Theia is the canonical consumer; any future consumer (e.g. an Atlas panel that shows "specs I own") reads the same data. |
| **ADR-009 (numbering)** | This is spec 015 (next free after 014; the 013 duplicate was resolved by [ADR-009](../../governance/decisions/ADR-009-resolve-spec-numbering-duplication.md)). |
| **Roadmap** | Not on the roadmap — tooling concern, like Theia itself. |

---

## 3. The canonical format (binding)

Every `specs/NNN-*/tasks.md` file follows this contract. The full human-readable reference — with worked examples and edge cases — lives in [`tools/theia/CONVENTIONS.md`](../../tools/theia/CONVENTIONS.md) (added by this spec's `plan.md`); the rules below are the binding summary.

```markdown
# Tasks — <Title>

**Status:** <Shipped | Planning | Draft>
**Derives from:** [Spec NNN](./spec.md) + [Plan NNN](./plan.md) <vX.Y.Z>
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md)
**Version:** <tasks.md version>
**Last updated:** <YYYY-MM-DD>

> Forward note.

---

## 1. Reality check (verified, not assumed)
…

## 2. <Build phase A>

- [x] T-01: <description> (AC-N)
- [x] T-02: <description> (AC-M)
- [ ] T-03: <description> (AC-P)

## 3. <Build phase B>

- [ ] T-04: <description> (AC-Q)
…
```

Rules (binding):

1. **One checkbox per task.** Each task is exactly one `- [x]` or `- [ ]` line. No nested checkboxes, no `| ✅ |` table cells, no inline `[x]` inside prose.
2. **Stable ID prefix.** Every checkbox carries a stable ID: `T-NN`, or module-prefixed (`OF-NN`, `IA-NN`, `J-NN`, …) when mirroring a multi-package spec. IDs are **never reused** within a spec, and a removed task's ID is **never reissued**.
3. **Sections numbered.** `## N.` headers separate logical groups (build phases, milestones, evidence runs). Build status lives in the checkbox state, not in a separate column.
4. **Spec AC traceability.** Each task line references at least one spec acceptance criterion (`(AC-N)`) or a justification like `(shipped)`.
5. **No status tables.** Tables for metadata (links, AC mapping) may stay; the *status column* disappears — it is encoded in the checkbox.
6. **`tasks.md` is mandatory** for every spec that is not `Superseded`. Draft specs may have an empty task list but the file must exist.

---

## 4. Goals

1. **One format, one regex.** Future maintenance of Theia's completion parser touches a single, well-documented regex (and its legacy fallback).
2. **Zero silent drift.** A new spec that violates the format fails `npm test` the same day it is written, not months later when someone opens Theia.
3. **Backward compatibility without backsliding.** The parser recognises the legacy emoji-table form as a *defensive fallback* — its purpose is to keep shipped specs honest during the migration window, not to legitimise the format. New specs MUST NOT use the legacy form; the linter enforces this.
4. **Surface drift in the tool itself.** A Theia widget lists non-conforming specs without requiring a restart cycle.

---

## 5. Non-goals (binding)

- Re-parsing `plan.md` checkboxes. Theia already does it (§4 of [Spec 012](../012-theia/spec.md)); this spec keeps that behaviour and introduces no new convention for `plan.md`.
- Reformatting `spec.md` itself. Spec 012 already parses `**Status:**` / `**Version:**` / `**Last updated:**` from `spec.md`; this spec changes nothing there. The linter only checks those fields are present and well-formed.
- Auto-syncing shipped status from git history. The checkbox is the source of truth; git is not consulted.
- A new visual design system. Theia continues to reuse Atlas tokens ([ADR-005](../../governance/decisions/ADR-005-atlas-driving-adapter.md)).
- Versioned spec numbering beyond what already exists. This is spec 015 (next free after 014).
- Tightening the spec template itself beyond `tasks.md`. The spec.md format is owned by every prior spec and changes there would balloon scope.

---

## 6. Acceptance criteria

**AC-1 (Canonical format).**
- *Given* a `tasks.md` written per §3,
- *When* Theia computes the spec's completion,
- *Then* the count equals `count("- [x]")` over `count("- [x]") + count("- [ ]")`, exactly.

**AC-2 (Backward compatibility during migration).**
- *Given* a legacy `tasks.md` with `| ✅ |` and `| ⏸ |` table cells and **no** markdown checkboxes,
- *When* Theia computes the spec's completion,
- *Then* `done = number of "✅" cells` and `total = "✅" + "⏸" cells`. A regression test fixture pins the count for one legacy file (pre-migration snapshot of spec 001).
- After the migration PR lands, this AC remains true by regression test but no production file matches the legacy form.

**AC-3 (Linter fails on drift).**
- *Given* a `tasks.md` that violates §3 (missing checkboxes, malformed IDs, etc.),
- *When* `npm test` runs,
- *Then* `tools/scripts/check-spec-conventions.mjs` exits non-zero with a list of offending files, each tagged with the failed rule.

**AC-4 (Theia drift widget).**
- *Given* any spec whose `tasks.md` is absent, contains zero checkboxes (and status ≠ `Draft`), or whose `spec.md` has `Unknown` status,
- *When* Theia serves the overview,
- *Then* a "Specs needing attention" widget lists each problem spec with a one-line reason. The widget is **not rendered** when the list is empty.

**AC-5 (Migration preserves counts and IDs).**
- *Given* the 13 existing specs that are not currently in canonical format,
- *When* this spec is ratified and the migration PR lands,
- *Then* for every migrated spec: (a) the pre-migration emoji count matches the post-migration checkbox count (AC-2 regression), and (b) every `T-NN` / `OF-NN` / `IA-NN` / `J-NN` ID is preserved verbatim.

---

## 7. Risks

- **R1 — Migration breaks traceability.** A spec's `T-NN` IDs are referenced from PR descriptions, ADRs, and downstream tasks. The migration preserves every existing ID verbatim; it only changes the surrounding markdown shape. *Mitigation:* AC-5 (b) and a hand-review of the migration diff. A second-pass human scan confirms.
- **R2 — Back-compat legitimises the legacy form.** If the defensive fallback stays in production, future authors might emit the legacy form and pass `npm test`. *Mitigation:* the linter is the source of enforcement (AC-3) — back-compat only fires for files with **zero** markdown checkboxes; a file with even one `- [x]` resolves to canonical counts only. An ADR records that new specs MUST NOT use the legacy form.
- **R3 — Drift widget becomes noise.** If the widget lists specs that are legitimately still being drafted, it loses signal. *Mitigation:* the widget filters out specs whose status is `Draft` *and* have zero checkboxes — drafts are allowed to be empty.

---

## 8. Events

This spec emits no platform events. It is a tooling/process change. The implementation touches only:

- `tools/theia/src/parser/completion.ts` — parser extension (defensive),
- `tools/theia/src/parser/specs.ts` — new `conventionIssues` field on `SpecCard`,
- `tools/theia/src/views/overview.ts` — new "Specs needing attention" section,
- `tools/theia/CONVENTIONS.md` — new human reference,
- `tools/scripts/check-spec-conventions.mjs` — new linter,
- `package.json` — linter wired into the `npm test` chain,
- 13 existing `specs/NNN-*/tasks.md` files (migration),
- 2 new `tasks.md` files (specs 003 and 005).

---

## 9. Open questions

None at draft time. The legacy emoji form is being deprecated (R2 mitigation in §7); the canonical format is fully specified in §3; the migration scope is bounded by the audit in §1.

If a reviewer raises an open question, it lands here in §9 and the spec re-enters Draft until resolved.

---

## 10. Subordination + deliverables

Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and [Spec 012](../012-theia/spec.md) (whose parser this spec formalises the input for).

- **`plan.md`** — implementation plan: parser extension (§3 of plan), linter design (§3), Theia widget shape (§4), migration order (§5), AC-to-test mapping (§6), definition of done (§7).
- **`tasks.md`** — task breakdown, written in the canonical format this spec defines (dogfooding). Tasks T-01..T-04 are the spec artefacts themselves; T-05..T-11 are the code surfaces; T-12..T-24 are the migration; T-25..T-28 are verification + ratification.

Implementation is authorised **only** after this spec is `Ratified` and an accompanying ADR (or steward approval, per the Spec-Driven gate in the [Constitution](../../memory/constitution.md) Article II) records the decision to bake the convention into code.