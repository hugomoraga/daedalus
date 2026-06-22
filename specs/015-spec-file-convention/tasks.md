# Tasks — Spec File Convention

**Status:** Ratified (PR #80 merged 2026-06-22; implementation PR follows)
**Derives from:** [Spec 015](./spec.md) + [Plan 015](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md) (forthcoming — added by T-03)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> The `/tasks` step for Spec 015. **Dogfoods the canonical format this spec defines** — every task in this file is a `- [x]` / `- [ ]` markdown checkbox with a stable ID. Spec artefacts (this file, `spec.md`, `plan.md`) are checked; code + migration are not.

> Build is authorised on spec ratification per the [Constitution](../../memory/constitution.md) Principle 8 (Spec-Driven). Tasks begin after the steward approves Spec 015 v0.1.0.

---

## 1. Reality check (verified, not assumed)

- Audit ran from the repo root. 15 specs inspected (`specs/001..014`). Findings: 2 already canonical (012, 013-atlas-demo-seeder). 11 use the legacy emoji-table form. 2 have no `tasks.md` (003, 005). All 15 have `spec.md` with the `**Status:**` / `**Version:**` / `**Last updated:**` fields Theia parses.
- The parser in `tools/theia/src/parser/completion.ts` has a single regex for checkboxes (line 16). Adding a second regex for emoji-table cells is a local change with no architectural impact.
- The npm `test` chain (root `package.json`) already runs four linter scripts after `node --test`. Adding `check-spec-conventions.mjs` follows the same pattern.
- Spec 013-atlas-demo-seeder already ships the format Spec 015 codifies — confirmed working in production.

---

## 2. Spec artefacts (spec + plan + convention doc)

These ship the spec triple and the human reference for the format.

- [x] T-01: Write `specs/015-spec-file-convention/spec.md` — the contract: why, what, AC, risks (spec §1-§10)
- [x] T-02: Write `specs/015-spec-file-convention/plan.md` — the design: parser, linter, widget, migration (plan §1-§9)
- [ ] T-03: Write `tools/theia/CONVENTIONS.md` — single human-readable source of truth, with worked examples (plan §7)
- [x] T-04: Write `specs/015-spec-file-convention/tasks.md` in canonical format — dogfood (this file)

## 3. Code

These ship the three enforcement surfaces.

- [ ] T-05: Extend `tools/theia/src/parser/completion.ts` — add `countLegacyTableRows`; resolve canonical-first inside `parseSpecCompletion` (plan §3) (AC-1, AC-2)
- [ ] T-06: Write `tools/scripts/check-spec-conventions.mjs` — fail on missing `tasks.md`, zero-checkbox `tasks.md` (non-Draft), malformed task ID, unknown Status word (plan §4) (AC-3)
- [ ] T-07: Wire `check-spec-conventions.mjs` into the `npm test` chain in root `package.json`; add `lint:spec-conventions` script (plan §4)
- [ ] T-08: Add Theia drift widget in `tools/theia/src/views/overview.ts` + new `conventionIssues` field in `parser/specs.ts` (plan §5) (AC-4)
- [ ] T-09: Tests for the extended parser — `tools/theia/tests/completion.test.ts` (AC-1, AC-2)
- [ ] T-10: Tests for the linter — `tools/scripts/tests/check-spec-conventions.test.mjs` (AC-3, all failure modes)
- [ ] T-11: Tests for the drift widget data — `tools/theia/tests/views.test.ts` (AC-4)

## 4. Migration

These convert the 13 existing specs that are not in canonical format. Each preserves existing IDs (AC-5 b) and existing shipped counts (AC-2 regression).

- [ ] T-12: Migrate `specs/001-revenue-visibility/tasks.md` — 16 ✅ rows → `- [x]`; 0 ⏸ rows
- [ ] T-13: Migrate `specs/002-proposal-generation/tasks.md` — 18 ✅
- [ ] T-14: Migrate `specs/004-tax-compliance-guard/tasks.md` — 1 ✅
- [ ] T-15: Migrate `specs/006-core-value-chain-completion/tasks.md` — 15 ✅
- [ ] T-16: Migrate `specs/007-atlas-ui/tasks.md` — 27 ✅
- [ ] T-17: Migrate `specs/008-workflow-engine/tasks.md` — 30 ✅
- [ ] T-18: Migrate `specs/009-policy-engine/tasks.md` — 18 ✅
- [ ] T-19: Migrate `specs/010-authoritative-rule-source/tasks.md` — 19 ✅
- [ ] T-20: Migrate `specs/011-workflow-engine-projections/tasks.md` — 14 ✅
- [ ] T-21: Migrate `specs/013-jurisdiction-model/tasks.md` — 19 ✅; canonicalise the mixed format
- [ ] T-22: Migrate `specs/014-social-to-opportunity-mvp/tasks.md` — 55 ✅
- [ ] T-23: Create `specs/003-opportunity-discovery/tasks.md` — forward-plan only, no shipped work to encode
- [ ] T-24: Create `specs/005-administrative-shield/tasks.md` — forward-plan only, no shipped work to encode

## 5. Verification + ratification

- [ ] T-25: Run `npm test` — all green (including new `check-spec-conventions`)
- [ ] T-26: Run `npm run theia -- check` — per-spec counts match a hand count of `- [x]` over `- [x]` + `- [ ]` for every spec
- [ ] T-27: Run `npm run theia -- serve` — drift widget visible pre-migration, hidden post-migration
- [ ] T-28: Open PR; spec ratified via the Spec-Driven gate ([Constitution](../../memory/constitution.md) Article II) and `**Status:**` flipped to `Ratified`

---

*Subordinate to [Spec 015](./spec.md) and [Plan 015](./plan.md). Dogfoods the canonical format from line one. Build authorised on spec ratification.*