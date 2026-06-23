// Theia (Spec 012) — specs parser tests (PR 2).
//
// Covers AC-3 (Status parsing + Unknown fallback), AC-4 (Task
// completion counting from tasks.md and plan.md). Uses an immutable
// fixture (`tests/fixtures/repo-typical/`) — never mutated by tests,
// never the live repo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";
import { parseSpecs, computeActivePhase } from "../src/parser/specs.ts";
import {
  countCheckboxes,
  countLegacyTableRows,
  parseSpecCompletion,
  parseTaskList,
  mergeCompletion,
} from "../src/parser/completion.ts";
import * as nodeFs from "node:fs";

const FIXTURE = fileURLToPath(new URL("./fixtures/repo-typical", import.meta.url));

// Defensive: the fixture must be a directory; if it's missing the test
// suite was set up wrong. Fail loudly here rather than at the first
// parse call.
test("fixture repo-typical exists and is a directory", () => {
  const st = statSync(FIXTURE);
  assert.ok(st.isDirectory(), `fixture must be a directory: ${FIXTURE}`);
});

// AC-3 (status parsing) + AC-2 (spec grid data source).
test("parseSpecs returns 4 cards for the typical fixture (001..004)", () => {
  const cards = parseSpecs(FIXTURE);
  assert.equal(cards.length, 4);
  // Sorted by NNN prefix ascending.
  assert.equal(cards[0]!.slug, "001-ratified-p2");
  assert.equal(cards[1]!.slug, "002-draft-p0");
  assert.equal(cards[2]!.slug, "003-blocked");
  assert.equal(cards[3]!.slug, "004-unknown");
});

test("AC-3: parses Ratified status + extracts Phase 2", () => {
  const cards = parseSpecs(FIXTURE);
  const card = cards.find((c) => c.slug === "001-ratified-p2");
  assert.ok(card !== undefined);
  assert.equal(card!.status, "Ratified");
  assert.equal(card!.phase, 2);
  assert.equal(card!.version, "1.0.0");
  assert.equal(card!.lastUpdated, "2026-06-01");
  assert.ok(card!.statusTail.includes("Phase 2"));
});

test("AC-3: parses Draft status + extracts Phase 0", () => {
  const cards = parseSpecs(FIXTURE);
  const card = cards.find((c) => c.slug === "002-draft-p0");
  assert.ok(card !== undefined);
  assert.equal(card!.status, "Draft");
  assert.equal(card!.phase, 0);
});

test("AC-3: parses Blocked status (first word of status line)", () => {
  const cards = parseSpecs(FIXTURE);
  const card = cards.find((c) => c.slug === "003-blocked");
  assert.ok(card !== undefined);
  assert.equal(card!.status, "Blocked");
  // The parser uses the FIRST WORD as status. The fixture starts with
  // "Blocked" so the prefix-collision case (e.g. "Draft · BLOCKED ..."
  // in older specs that pinned "Draft") is exercised elsewhere by
  // the live-repo test, not here.
  assert.ok(card!.statusTail.includes("unblockers built"));
});

test("AC-3: Unknown fallback when Status line is missing", () => {
  const cards = parseSpecs(FIXTURE);
  const card = cards.find((c) => c.slug === "004-unknown");
  assert.ok(card !== undefined);
  assert.equal(card!.status, "Unknown");
  assert.ok(card!.unknownReason !== null);
  assert.match(card!.unknownReason ?? "", /Status line missing/);
});

test("AC-4: parses task completion from tasks.md and plan.md", () => {
  const cards = parseSpecs(FIXTURE);
  const card = cards.find((c) => c.slug === "001-ratified-p2");
  assert.ok(card !== undefined);
  // tasks.md has 4 boxes (3 done, 1 pending); plan.md has 3 boxes (2 done, 1 pending).
  assert.equal(card!.tasksDone, 3);
  assert.equal(card!.tasksTotal, 4);
  assert.equal(card!.planDone, 2);
  assert.equal(card!.planTotal, 3);
});

test("AC-4: missing tasks.md → 0/0 for tasks (does not throw)", () => {
  const c = parseSpecCompletion(FIXTURE, "002-draft-p0");
  assert.equal(c.tasks.done, 0);
  assert.equal(c.tasks.total, 0);
  // plan.md missing for this spec too.
  assert.equal(c.plan.done, 0);
  assert.equal(c.plan.total, 0);
  assert.equal(c.done, 0);
  assert.equal(c.total, 0);
});

test("computeActivePhase returns the highest Ratified phase", () => {
  const cards = parseSpecs(FIXTURE);
  // Only "001-ratified-p2" is Ratified + phase=2; "002-draft-p0" is Draft,
  // "003-blocked" parses as Draft (first word), "004-unknown" is Unknown.
  // The fixture pins the prefix-collision case; the parser still surfaces
  // Ratified from 001, so activePhase = 2.
  assert.equal(computeActivePhase(cards), 2);
});

test("countCheckboxes is a pure function (no I/O)", () => {
  // Empty string → 0/0.
  assert.deepEqual(countCheckboxes(""), { done: 0, total: 0 });
  // Mixed boxes.
  const md = `# Title
- [x] done
- [ ] pending
- [X] done (uppercase X)
- [x]done (no space after closing bracket is NOT a checkbox — verify)
- regular text
`;
  const result = countCheckboxes(md);
  // Only the properly-formed checkboxes count.
  assert.equal(result.done, 2);
  assert.equal(result.total, 3);
});

test("mergeCompletion sums two counts", () => {
  assert.deepEqual(mergeCompletion({ done: 1, total: 2 }, { done: 3, total: 5 }), { done: 4, total: 7 });
  assert.deepEqual(mergeCompletion({ done: 0, total: 0 }, { done: 0, total: 0 }), { done: 0, total: 0 });
});

// ----------------------------------------------------------------------------
// Spec 015 — canonical format (AC-1, AC-2)
// ----------------------------------------------------------------------------

// Spec 015 §6 AC-1: countCheckboxes is the canonical path; a file with
// even one `- [x]` resolves to canonical counts only.
test("AC-1: countCheckboxes returns exact done/total for the canonical format", () => {
  const md = `# Tasks

- [x] T-01: first (AC-1)
- [x] T-02: second (AC-2)
- [ ] T-03: third (AC-3)
- [x] T-04: fourth (AC-4)
`;
  assert.deepEqual(countCheckboxes(md), { done: 3, total: 4 });
});

// Spec 015 §6 AC-2: countLegacyTableRows recognises the legacy
// emoji-table form. Only fires when the file has zero checkboxes.
test("AC-2: countLegacyTableRows recognises | ✅ | / | ⏸ | / | ⛔ | cells", () => {
  const md = `| ID | Task | Status |
|---|---|---|
| T-01 | first | ✅ |
| T-02 | second | ✅ |
| T-03 | third | ⏸ |
| T-04 | fourth | ⛔ |
`;
  assert.deepEqual(countLegacyTableRows(md), { done: 2, total: 4 });
});

test("AC-2: countLegacyTableRows returns 0/0 for canonical-only input", () => {
  const md = `- [x] T-01
- [ ] T-02
`;
  assert.deepEqual(countLegacyTableRows(md), { done: 0, total: 0 });
});

test("AC-2: empty file yields 0/0 for both counters", () => {
  assert.deepEqual(countCheckboxes(""), { done: 0, total: 0 });
  assert.deepEqual(countLegacyTableRows(""), { done: 0, total: 0 });
});

// Spec 015 §6 AC-1 (canonical-first resolution): when a file has BOTH
// checkboxes AND legacy cells, the canonical count wins.
test("AC-1 + AC-2: parseSpecCompletion prefers canonical over legacy when both present", () => {
  const dir = join(FIXTURE, "specs", "_mix-fixture");
  nodeFs.mkdirSync(dir, { recursive: true });
  try {
    // Both formats in the same file: 2 canonical + 1 legacy cell.
    // Expected: canonical wins → done=1, total=2.
    nodeFs.writeFileSync(
      join(dir, "tasks.md"),
      `- [x] T-01: canonical done\n- [ ] T-02: canonical pending\n\n| ID | Status |\n|---|---|\n| X-99 | ✅ |\n`,
    );
    const c = parseSpecCompletion(FIXTURE, "_mix-fixture");
    assert.equal(c.tasks.done, 1);
    assert.equal(c.tasks.total, 2);
  } finally {
    nodeFs.rmSync(dir, { recursive: true, force: true });
  }
});

// Spec 015 §6 AC-2: when a file has ONLY legacy cells, legacy count wins.
test("AC-2: parseSpecCompletion falls back to legacy when no checkboxes", () => {
  const dir = join(FIXTURE, "specs", "_legacy-fixture");
  nodeFs.mkdirSync(dir, { recursive: true });
  try {
    nodeFs.writeFileSync(
      join(dir, "tasks.md"),
      `| ID | Task | Status |\n|---|---|---|\n| T-01 | done | ✅ |\n| T-02 | done | ✅ |\n| T-03 | pending | ⏸ |\n`,
    );
    const c = parseSpecCompletion(FIXTURE, "_legacy-fixture");
    assert.equal(c.tasks.done, 2);
    assert.equal(c.tasks.total, 3);
  } finally {
    nodeFs.rmSync(dir, { recursive: true, force: true });
  }
});

// Spec 015 §6 AC-4 (drift widget data): conventionIssues surfaces
// problems on the SpecCard itself, not just the parser's hidden
// state. Parse the typical fixture and confirm the widget would
// find what it needs.
test("AC-4: conventionIssues is empty for a clean canonical spec", () => {
  const cards = parseSpecs(FIXTURE);
  const clean = cards.find((c) => c.slug === "001-ratified-p2");
  assert.ok(clean !== undefined);
  assert.ok(Array.isArray(clean!.conventionIssues));
  assert.deepEqual(clean!.conventionIssues, []);
});

// Spec 015 §6 AC-4: conventionIssues surfaces Unknown status.
test("AC-4: conventionIssues surfaces 'Unknown status' for the unknown-status fixture", () => {
  const cards = parseSpecs(FIXTURE);
  const unknown = cards.find((c) => c.slug === "004-unknown");
  assert.ok(unknown !== undefined);
  assert.ok(unknown!.conventionIssues.some((i) => i.startsWith("Unknown status")));
});

// AC-2: each card carries the artifact links (spec / plan / tasks).
test("AC-2: cards carry links to spec/plan/tasks (or null when missing)", () => {
  const cards = parseSpecs(FIXTURE);
  const ratified = cards.find((c) => c.slug === "001-ratified-p2")!;
  assert.equal(ratified.links.spec, "specs/001-ratified-p2/spec.md");
  assert.equal(ratified.links.plan, "specs/001-ratified-p2/plan.md");
  assert.equal(ratified.links.tasks, "specs/001-ratified-p2/tasks.md");
  const draft = cards.find((c) => c.slug === "002-draft-p0")!;
  assert.equal(draft.links.plan, null);
  assert.equal(draft.links.tasks, null);
});

// UX-003: parseTaskList returns one TaskItem per canonical checkbox
// line, grouped by the most recent `## Heading`. Empty string for
// the section when no heading has been seen.
test("UX-003: parseTaskList extracts id, text, done, and section", () => {
  const md = `## PR 1 — Scaffold

- [x] T-01: first done
- [ ] T-02: second pending
- [X] T-03: third done (uppercase X)

## PR 2 — Parser

- [ ] T-11: parse specs
- [x] T-12: parse completion
`;
  const items = parseTaskList(md);
  assert.equal(items.length, 5);
  assert.deepEqual(items[0], { id: "T-01", text: "first done", done: true, section: "PR 1 — Scaffold" });
  assert.deepEqual(items[1], { id: "T-02", text: "second pending", done: false, section: "PR 1 — Scaffold" });
  assert.deepEqual(items[2], { id: "T-03", text: "third done (uppercase X)", done: true, section: "PR 1 — Scaffold" });
  assert.deepEqual(items[3], { id: "T-11", text: "parse specs", done: false, section: "PR 2 — Parser" });
  assert.deepEqual(items[4], { id: "T-12", text: "parse completion", done: true, section: "PR 2 — Parser" });
});

test("UX-003: parseTaskList returns empty section for files with no ## headings", () => {
  const md = `- [x] T-01: alone\n- [ ] T-02: also alone\n`;
  const items = parseTaskList(md);
  assert.equal(items.length, 2);
  assert.equal(items[0]!.section, "");
  assert.equal(items[1]!.section, "");
});

test("UX-003: parseTaskList skips legacy table rows, bullets without id, and ## headings", () => {
  const md = `## Real section

- [x] T-01: real task
- [ ] bullet without id
| ID | Task | Status |
| T-02 | legacy | ✅ |
- [x] OF-12: alphanumeric id with extra letter
`;
  const items = parseTaskList(md);
  assert.equal(items.length, 2);
  assert.equal(items[0]!.id, "T-01");
  assert.equal(items[1]!.id, "OF-12");
});

test("UX-003: parseTaskList returns [] for empty content", () => {
  assert.deepEqual(parseTaskList(""), []);
});

// UX-003: SpecCard.taskList is populated by the parser for the
// fixture's ratified spec.
test("UX-003: SpecCard.taskList is populated from tasks.md", () => {
  const cards = parseSpecs(FIXTURE);
  const ratified = cards.find((c) => c.slug === "001-ratified-p2")!;
  assert.equal(ratified.taskList.length, 4);
  assert.equal(ratified.taskList[0]!.id, "T-01");
  assert.equal(ratified.taskList[0]!.done, true);
  assert.equal(ratified.taskList[2]!.id, "T-03");
  assert.equal(ratified.taskList[2]!.done, false);
});

test("UX-003: SpecCard.taskList is empty when tasks.md is missing", () => {
  const cards = parseSpecs(FIXTURE);
  const draft = cards.find((c) => c.slug === "002-draft-p0")!;
  assert.deepEqual(draft.taskList, []);
});

// AC-14: parser output is byte-deterministic for the same fixture.
test("AC-14: two parseSpecs calls produce identical card arrays", () => {
  const a = parseSpecs(FIXTURE);
  const b = parseSpecs(FIXTURE);
  assert.deepEqual(a, b);
});

// Directory listings without spec.md (e.g. evidence/) are silently
// skipped — but our fixture has only spec dirs, so we add an extra
// non-spec dir here and re-parse.
test("non-spec directories (no spec.md) are ignored", async () => {
  const { mkdirSync } = await import("node:fs");
  const noise = join(FIXTURE, "specs", "099-evidence");
  mkdirSync(noise, { recursive: true });
  try {
    const cards = parseSpecs(FIXTURE);
    assert.equal(cards.length, 4);
    assert.equal(cards.find((c) => c.slug === "099-evidence"), undefined);
  } finally {
    const { rmSync } = await import("node:fs");
    rmSync(noise, { recursive: true, force: true });
  }
});

// Live repo: parseRepo must surface 12+ specs (sanity check the wiring).
// Resolve the repo root from THIS test file's location, not from
// process.cwd() — under `node --test` the runner's CWD can differ
// from where the developer invoked the test.
test("parseRepo on the live repo surfaces specs from specs/", async () => {
  const { parseRepo } = await import("../src/parser.ts");
  // tools/theia/tests/parser-specs.test.ts → repoRoot is 4 dirname()s up:
  //   tests → theia → tools → <repo>
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const { state } = await parseRepo(repoRoot);
  assert.ok(state.specs.length >= 12, `expected ≥12 specs from ${repoRoot}, got ${state.specs.length}`);
  // At least one Ratified spec (most of the codebase ships with one).
  assert.ok(state.specs.some((s) => s.status === "Ratified"));
});
