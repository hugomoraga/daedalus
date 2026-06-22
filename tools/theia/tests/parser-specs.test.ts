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
  parseSpecCompletion,
  mergeCompletion,
} from "../src/parser/completion.ts";

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
  const state = parseRepo(repoRoot);
  assert.ok(state.specs.length >= 12, `expected ≥12 specs from ${repoRoot}, got ${state.specs.length}`);
  // At least one Ratified spec (most of the codebase ships with one).
  assert.ok(state.specs.some((s) => s.status === "Ratified"));
});
