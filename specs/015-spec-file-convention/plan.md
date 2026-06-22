# Plan 015 — Spec File Convention

**Status:** Draft · companion to [Spec 015](./spec.md) v0.1.0
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-007](../../governance/decisions/ADR-007-theia-as-tools-directory.md), [Spec 012](../012-theia/spec.md)

> Design for the changes [Spec 015](./spec.md) mandates. Touches one parser module, one new script, one Theia view, 13 existing `tasks.md` files (migration), and 2 new `tasks.md` files (specs 003 and 005).

---

## 0. Open questions (carried from Spec 015 §9)

None. The spec was authored without open questions; the plan inherits that.

---

## 1. Scope summary

Five code surfaces, fifteen spec files.

| Surface | Type | File |
|---|---|---|
| Parser extension | Behavioural addition (defensive) | `tools/theia/src/parser/completion.ts` |
| Convention linter | New script | `tools/scripts/check-spec-conventions.mjs` |
| Theia drift widget | View addition + data field | `tools/theia/src/views/overview.ts`, `tools/theia/src/parser/specs.ts` |
| Convention doc | Human reference | `tools/theia/CONVENTIONS.md` |
| Spec migration | 13 file rewrites + 2 new files | `specs/001..014/*/tasks.md` |

---

## 2. Decisions taken from the start

- **Canonical format wins when both are present.** A `tasks.md` that contains even one `- [x]` resolves to canonical counts only. The legacy emoji-table count is used only when the file has zero checkboxes. This makes back-compat a defensive fallback, not a legitimate choice (Spec §7 R2).
- **Linter is a script, not a unit test.** It runs in `npm test` (the existing `&&`-chain pattern) but is a standalone `.mjs` so it can also be run on demand (`node tools/scripts/check-spec-conventions.mjs`). Same pattern as `check-core-jurisdiction-agnostic.mjs`.
- **Drift widget is a section, not a separate page.** It rides on the existing overview route. No new HTTP endpoint, no new view file.
- **Migration is one PR.** Splitting it across multiple PRs would create intermediate windows where some specs use one format and some another — which defeats the purpose.

---

## 3. Parser extension (T-05)

Add a sibling counter to `completion.ts`. Keep the API of `countCheckboxes` unchanged; add `countLegacyTableRows(content)` returning `{ done, total }`.

```ts
// New regex — only matches a status column cell with the legacy emojis.
const LEGACY_RE = /^\s*\|[^|\n]*[✅⏸⛔][^|\n]*\|/gm;
```

Resolution rule inside `parseSpecCompletion` (replace lines 36-47):

```ts
export function parseSpecCompletion(rootPath: string, slug: string): SpecCompletion {
  const tasksPath = join(rootPath, "specs", slug, "tasks.md");
  const planPath  = join(rootPath, "specs", slug, "plan.md");

  const tasksContent = existsSync(tasksPath) ? readFileSync(tasksPath, "utf8") : "";
  const planContent  = existsSync(planPath)  ? readFileSync(planPath, "utf8")  : "";

  // Canonical format wins if present.
  const tasksCanonical = countCheckboxes(tasksContent);
  const tasks = tasksCanonical.total > 0
    ? tasksCanonical
    : (existsSync(tasksPath) ? countLegacyTableRows(tasksContent) : { done: 0, total: 0 });

  const planCanonical = countCheckboxes(planContent);
  const plan = planCanonical.total > 0
    ? planCanonical
    : (existsSync(planPath) ? countLegacyTableRows(planContent) : { done: 0, total: 0 });

  return {
    done: tasks.done + plan.done,
    total: tasks.total + plan.total,
    tasks,
    plan,
  };
}
```

Test fixtures (AC-1, AC-2):

- `fixtures/tasks/canonical-checkbox.md` — mixed `- [x]` / `- [ ]`.
- `fixtures/tasks/canonical-plus-legacy.md` — both present; canonical wins.
- `fixtures/tasks/legacy-emoji-table.md` — spec 001 pre-migration snapshot.
- `fixtures/tasks/empty.md` — empty file → 0/0.

---

## 4. Linter (T-06, T-07)

New file `tools/scripts/check-spec-conventions.mjs`. Pure Node 22, zero deps. Walks `specs/NNN-*` directories.

### Checks per spec

| Check | Severity | Reason |
|---|---|---|
| `spec.md` exists | **fail** | Theia needs it |
| `**Status:**` line present | **fail** | Theia needs it (Spec 012 AC-3) |
| First word of `**Status:**` is recognised | **fail** | Otherwise Theia shows "Unknown" |
| `**Version:**` and `**Last updated:**` present | warn | Theia reads them; not blocking |
| `tasks.md` exists (unless Status = `Superseded`) | **fail** | New convention: mandatory |
| `tasks.md` has ≥ 1 checkbox OR Status = `Draft` | **fail** | Empty tasks.md only allowed for Draft |
| Task IDs match `^(T\|OF\|IA\|J\|P\|M\|AC\|R)-\d+$` (or known legacy) | warn | Informational |
| `plan.md` checkbox count, if present, is consistent with what the parser reports | warn | Informational |

Recognised status words: `Ratified`, `Draft`, `Blocked`, `Superseded`, `Planning`, `Shipped`.

### Exit codes

- `0` — clean.
- `1` — at least one fail.
- `2` — only warns (informational; CI may choose to pass).

### Wire-up

`package.json` `scripts.test`:

```diff
- "test": "node --test && node scripts/check-core-jurisdiction-agnostic.mjs && node scripts/check-rulesets-have-provenance.mjs && node scripts/check-policies-have-provenance.mjs && node scripts/check-rule-source-staleness.mjs",
+ "test": "node --test && node scripts/check-core-jurisdiction-agnostic.mjs && node scripts/check-rulesets-have-provenance.mjs && node scripts/check-policies-have-provenance.mjs && node scripts/check-rule-source-staleness.mjs && node scripts/check-spec-conventions.mjs",
```

Also add a top-level script: `"lint:spec-conventions": "node tools/scripts/check-spec-conventions.mjs"` (mirrors the four existing `lint:*` scripts).

---

## 5. Drift widget (T-08, T-11)

### Data field

Extend `SpecCard` in `tools/theia/src/types.ts`:

```ts
export interface SpecCard {
  // ...existing fields
  conventionIssues: string[];
}
```

Populate inside `parseOne` (`parser/specs.ts`):

```ts
const issues: string[] = [];
if (!existsSync(tasksPath)) {
  issues.push("tasks.md missing");
} else if (card.tasksTotal === 0 && card.tasksDone === 0 && card.status !== "Draft") {
  issues.push("tasks.md has 0 checkboxes");
}
if (card.status === "Unknown") {
  issues.push(`Unknown status: ${card.unknownReason ?? "unparsed"}`);
}
card.conventionIssues = issues;
```

### View

New section in `renderOverview`, placed between `renderSpecGrid` and `renderAdrsSection`. Title: **"Specs needing attention"**. Hidden when the global list is empty.

```ts
function renderDriftWidget(state: ProjectState): string {
  const all: Array<{ slug: string; issue: string }> = [];
  for (const s of state.specs) {
    for (const issue of s.conventionIssues) {
      all.push({ slug: s.slug, issue });
    }
  }
  if (all.length === 0) return ""; // hidden
  const items = all.map(({ slug, issue }) =>
    `<li><code>${escapeHtml(slug)}</code> <span class="muted">— ${escapeHtml(issue)}</span></li>`
  ).join("");
  return section("Specs needing attention", `<ul class="theia-mono">${items}</ul>`);
}
```

(No link from the widget — the spec grid already links to `spec.md`.)

---

## 6. Migration order (T-12..T-24)

Lowest risk first:

1. **Smallest specs to validate the recipe** (004 = 1 ✅, 005 = no tasks.md yet, 003 = no tasks.md yet, 013-jurisdiction = 19 ✅ mixed format).
2. **Mid-size shipped specs** (001 = 16 ✅, 002 = 18 ✅, 006 = 15 ✅, 010 = 19 ✅, 011 = 14 ✅).
3. **Largest shipped specs** (007 = 27 ✅, 008 = 30 ✅, 009 = 18 ✅, 014 = 55 ✅).
4. **No-op** for 012 (already canonical, 74/116) and 013-atlas-demo-seeder (already canonical, 19 + 22 plan). These get a regression-test pass only (AC-1), no file edit.

Each migration preserves:

- every existing `T-NN` / `OF-NN` / `IA-NN` / `J-NN` ID verbatim,
- the section structure (numbered `## N.` headers grouped by phase/version),
- the prose in non-task content (reality check, Q&A resolutions, evidence notes).

The mechanical change:

- `| ✅ |` table cell → `- [x]`.
- `| ⏸ |` table cell → `- [ ]`.
- The rest of the column content is reformatted onto one bullet line: `- [x] T-NN: <description> (<AC ref>)`.

Tables for **metadata** (links, AC mapping) may stay; only the **status column** disappears.

For 003 and 005 (no `tasks.md` yet): create the file with a header, a "Reality check" section, and an empty task list. Status: `Draft`. The migration PR explicitly does **not** invent shipped tasks for them.

---

## 7. Convention doc (T-03)

New file `tools/theia/CONVENTIONS.md`. Single source of truth for the canonical format. Sections:

1. **Why this exists** — link to Spec 015 §1.
2. **The canonical format** — verbatim from Spec 015 §3, with a worked example.
3. **Edge cases** — multi-package specs (`OF-NN`, `IA-NN`), tasks that span multiple ACs, intentional gaps.
4. **What changed** — short migration note pointing to Spec 015 §6.
5. **Cross-references** — links to Theia parser, the linter, the widget.

About 60-100 lines. No code blocks beyond the format example. Lives next to `tools/theia/README.md`.

---

## 8. AC-to-test mapping

| AC | Test file | Test name |
|---|---|---|
| AC-1 | `tools/theia/tests/completion.test.ts` | "canonical checkbox count is exact" |
| AC-1 | `tools/theia/tests/completion.test.ts` | "canonical count wins when legacy cells also present" |
| AC-2 | `tools/theia/tests/completion.test.ts` | "legacy emoji-table count matches spec 001 pre-migration" |
| AC-2 | `tools/theia/tests/completion.test.ts` | "empty tasks.md yields 0/0" |
| AC-3 | `tools/scripts/tests/check-spec-conventions.test.mjs` | "fails on missing tasks.md" |
| AC-3 | `tools/scripts/tests/check-spec-conventions.test.mjs` | "fails on zero-checkbox tasks.md for non-Draft status" |
| AC-3 | `tools/scripts/tests/check-spec-conventions.test.mjs` | "fails on malformed task ID" |
| AC-3 | `tools/scripts/tests/check-spec-conventions.test.mjs` | "fails on unknown Status word" |
| AC-3 | `tools/scripts/tests/check-spec-conventions.test.mjs` | "passes on canonical input" |
| AC-4 | `tools/theia/tests/views.test.ts` | "drift widget hidden when no issues" |
| AC-4 | `tools/theia/tests/views.test.ts` | "drift widget lists one row per issue" |
| AC-5 | (manual + AC-2 regression) | "every migrated spec preserves pre-migration count and IDs" |

Test fixtures: `tools/theia/tests/fixtures/tasks/` (4 files for AC-1/AC-2) and `tools/scripts/tests/fixtures/specs/` (5 minimal dirs for AC-3).

---

## 9. Definition of done

- Every `T-NN` in `tasks.md` is checked (`- [x]`).
- `npm test` is green, including `check-spec-conventions`.
- `npm run theia -- check` reports per-spec counts that match a hand count of `- [x]` over `- [x]` + `- [ ]` for every spec.
- `npm run theia -- serve` shows the drift widget populated (pre-migration), then empty (post-migration).
- Migration PR opened, reviewed, merged.
- Spec 015 status flipped to `Ratified`. (Per the Spec-Driven gate, this happens *after* the PR is reviewed and accepted — see [Constitution](../../memory/constitution.md) Article II.)

---

*Subordinate to [Spec 015](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Build authorised on spec ratification.*