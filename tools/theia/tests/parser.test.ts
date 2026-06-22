// Theia (Spec 012) — parser skeleton tests (PR 1).
//
// Covers AC-14 (Deterministic parser) at the skeleton level: given a
// fixed repo state, two parser calls produce byte-identical JSON.
// Later PRs (2–7) add fixture-based tests for each parsing phase.
//
// Uses `node --test`. Test data is the live repo + a temp dir; no
// fixtures file in PR 1 (the fixtures land in PR 2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRepo } from "../src/parser.ts";

test("parseRepo returns a typed ProjectState shape", () => {
  const state = parseRepo(process.cwd());
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

test("parseRepo with the live repo surfaces specs (PR 2 wired parseSpecs)", () => {
  const state = parseRepo(process.cwd());
  // PR 2 wired parseSpecs + completion; the parser now reads the
  // live repo's specs/NNN-* directories. The other collections
  // (adrs, useCases, codeInventory, phases, blockers, nextUnlocks,
  // diff, tests) remain placeholders until PRs 3–7 wire them.
  assert.ok(state.specs.length > 0, "live repo has specs");
  // PR 1 placeholder contracts still hold for the un-wired collections.
  assert.equal(state.adrs.length, 0);
  assert.equal(state.useCases.length, 0);
  assert.equal(state.codeInventory.length, 0);
  assert.equal(state.phases.length, 0);
  assert.equal(state.blockers.length, 0);
  assert.equal(state.nextUnlocks.length, 0);
  assert.equal(state.diff.available, false);
  assert.equal(state.tests.running, false);
});

test("parseRepo with a non-existent root returns empty state without throwing", () => {
  // mkdtempSync gives us a real dir; we then pass a child path that
  // does not exist. The parser must not throw — it returns an empty
  // state with the requested rootPath echoed back.
  const baseDir = mkdtempSync(join(tmpdir(), "theia-parser-"));
  const ghost = join(baseDir, "does-not-exist");
  const state = parseRepo(ghost);
  assert.equal(state.rootPath, ghost);
  assert.equal(state.specs.length, 0);
  // The computedAt is still set (deterministic within a single call).
  assert.ok(state.computedAt.length > 0);
});

test("AC-14 (skeleton): two parser calls produce identical JSON", () => {
  // AC-14 requires the parser be deterministic for a fixed repo state.
  // The skeleton returns an empty state with `computedAt` set at call
  // time, so we snapshot the value of computedAt across two calls by
  // reading the same state first, then asserting equality of the
  // JSON-serializable parts (specs, adrs, etc.) — `computedAt` is
  // intentionally excluded since it varies per call.
  const a = parseRepo(process.cwd());
  const b = parseRepo(process.cwd());
  const stripComputedAt = (s: typeof a): Omit<typeof a, "computedAt"> => {
    const { computedAt: _omit, ...rest } = s;
    void _omit;
    return rest;
  };
  assert.deepEqual(stripComputedAt(a), stripComputedAt(b));
});

test("AC-14 (skeleton): two parser calls on a non-existent root are deterministic too", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "theia-parser-"));
  const ghost = join(baseDir, "ghost");
  const a = parseRepo(ghost);
  const b = parseRepo(ghost);
  const stripComputedAt = (s: typeof a): Omit<typeof a, "computedAt"> => {
    const { computedAt: _omit, ...rest } = s;
    void _omit;
    return rest;
  };
  assert.deepEqual(stripComputedAt(a), stripComputedAt(b));
});
