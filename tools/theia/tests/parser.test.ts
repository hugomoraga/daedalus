// Theia (Spec 012) — parser skeleton tests (PR 1).
//
// Covers AC-14 (Deterministic parser) at the skeleton level: given a
// fixed repo state, two parser calls produce byte-identical JSON.
// Later PRs (2–7) add fixture-based tests for each parsing phase.
//
// PR 6 made `parseRepo` async (it shells out to git). All tests that
// call `parseRepo` here are therefore `async` and `await` the result.
//
// Uses `node --test`. Test data is the live repo + a temp dir; no
// fixtures file in PR 1 (the fixtures land in PR 2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRepo } from "../src/parser.ts";

test("parseRepo returns a typed ProjectState shape", async () => {
  const { state } = await parseRepo(process.cwd());
  assert.equal(typeof state.rootPath, "string");
  assert.equal(typeof state.computedAt, "string");
  assert.ok(Array.isArray(state.specs));
  assert.ok(Array.isArray(state.adrs));
  assert.ok(Array.isArray(state.useCases));
  assert.ok(Array.isArray(state.codeInventory));
  assert.ok(Array.isArray(state.phases));
  assert.equal(typeof state.activePhase, "number");
  assert.ok(Array.isArray(state.blockers));
  assert.ok(Array.isArray(state.nextUnlocks));
  assert.equal(typeof state.diff, "object");
  assert.equal(typeof state.tests, "object");
});

test("parseRepo with the live repo surfaces specs + ADRs + phases + inventory + useCases (PR 5)", async () => {
  // Resolve the repo root from THIS test file's location, not from
  // process.cwd() — under `node --test` the runner's CWD can differ.
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const { state } = await parseRepo(repoRoot);
  // PRs 2–5 wired: specs, completion, ADRs, phases, inventory,
  // useCases, blockers (live repo has no BLOCKED specs today).
  assert.ok(state.specs.length > 0, "live repo has specs");
  assert.ok(state.adrs.length > 0, "live repo has ADRs");
  assert.ok(state.phases.length > 0, "live repo has phases");
  assert.ok(state.codeInventory.length > 0, "live repo has apps + packages");
  assert.ok(state.useCases.length > 0, "live repo has CLI commands");
  // PRs 6–7: git diff + test runner are both wired. The test runner
  // starts npm test in the background; the parser returns the
  // running-placeholder immediately.
  assert.equal(typeof state.diff.available, "boolean");
  assert.equal(state.tests.running, true);
  // Awaiting the pendingTests promise resolves to the final result.
  // (Skipped here — Node ≥ 22 detects the recursive spawn inside a
  // test runner; the integration check is via `npm run theia check`.)
});

test("parseRepo with a non-existent root returns empty state without throwing", async () => {
  // mkdtempSync gives us a real dir; we then pass a child path that
  // does not exist. The parser must not throw — it returns an empty
  // state with the requested rootPath echoed back.
  const baseDir = mkdtempSync(join(tmpdir(), "theia-parser-"));
  const ghost = join(baseDir, "does-not-exist");
  const { state } = await parseRepo(ghost);
  assert.equal(state.rootPath, ghost);
  assert.equal(state.specs.length, 0);
  // The computedAt is still set (deterministic within a single call).
  assert.ok(state.computedAt.length > 0);
});

test("AC-14 (skeleton): two parser calls produce identical JSON", async () => {
  // AC-14 requires the parser be deterministic for a fixed repo state.
  // `computedAt` + `tests.startedAt` + `tests.completedAt` vary per
  // call (they're real timestamps). Strip them before comparing.
  const { state: a } = await parseRepo(process.cwd());
  const { state: b } = await parseRepo(process.cwd());
  const stripTimestamps = (s: typeof a): Omit<typeof a, "computedAt"> => {
    const { computedAt: _omit, ...rest } = s;
    void _omit;
    const { startedAt: _sa, completedAt: _ca, ...testRest } = rest.tests;
    void _sa;
    void _ca;
    return { ...rest, tests: testRest };
  };
  assert.deepEqual(stripTimestamps(a), stripTimestamps(b));
});

test("AC-14 (skeleton): two parser calls on a non-existent root are deterministic too", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "theia-parser-"));
  const ghost = join(baseDir, "ghost");
  const { state: a } = await parseRepo(ghost);
  const { state: b } = await parseRepo(ghost);
  const stripComputedAt = (s: typeof a): Omit<typeof a, "computedAt"> => {
    const { computedAt: _omit, ...rest } = s;
    void _omit;
    return rest;
  };
  assert.deepEqual(stripComputedAt(a), stripComputedAt(b));
});