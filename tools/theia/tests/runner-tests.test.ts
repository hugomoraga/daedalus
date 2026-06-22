// Theia (Spec 012) — npm test runner tests (PR 7).
//
// Covers AC-8 (Test run at startup — running… placeholder while npm
// test runs in the background, updates without a server restart).
//
// Pure parser (`parseNodeTestOutput`) is exercised with mocked
// TAP-like strings.
//
// The async runner itself (`runNpmTest`, `runNpmTestSync`) cannot be
// tested inside the project test suite — Node ≥ 22 detects when a
// child `node --test` is spawned from inside a `node --test` parent
// and **skips** the child with the warning:
//   `node:test run() is being called recursively within a test file`
// The runner still works correctly outside the test runner (e.g. via
// `npm run theia check`); we document this in Plan 012 §6
// (Acceptance) and the runner's source comments.
//
// AC-8 in production: `npm run theia check` runs in the user's shell
// (not inside a test runner) and the runner captures `node --test`
// output normally.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNodeTestOutput } from "../src/runners/tests.ts";

test("AC-8: parseNodeTestOutput extracts pass/fail totals from the TAP summary", () => {
  const stdout = [
    "TAP version 13",
    "# Subtest: AC-1",
    "ok 1 - AC-1",
    "not ok 2 - AC-2",
    "  ---",
    "  error: 'expected true'",
    "  ...",
    "# tests 2",
    "# pass 1",
    "# fail 1",
    "",
  ].join("\n");
  const result = parseNodeTestOutput(stdout, "", 0);
  assert.equal(result.running, false);
  assert.equal(result.total, 2);
  assert.equal(result.pass, 1);
  assert.equal(result.fail, 1);
  assert.deepEqual(result.failingNames, ["AC-2"]);
});

test("AC-8: parseNodeTestOutput extracts multiple failing test names", () => {
  const stdout = [
    "TAP version 13",
    "ok 1 - first",
    "not ok 2 - second",
    "not ok 3 - third",
    "# tests 3",
    "# pass 1",
    "# fail 2",
  ].join("\n");
  const result = parseNodeTestOutput(stdout, "", 0);
  assert.equal(result.fail, 2);
  assert.deepEqual(result.failingNames, ["second", "third"]);
});

test("AC-8: parseNodeTestOutput handles empty stdout (running=true would be the placeholder)", () => {
  const result = parseNodeTestOutput("", "", 0);
  assert.equal(result.running, false);
  assert.equal(result.total, null);
  assert.equal(result.reason, "could not parse npm test summary");
});

test("AC-8: parseNodeTestOutput surfaces non-zero exit as a reason when summary is absent", () => {
  const result = parseNodeTestOutput("", "command not found: node", 127);
  assert.equal(result.reason, "command not found: node");
  assert.equal(result.total, null);
});

test("AC-8: parseNodeTestOutput handles missing failing-test lines (pass=total)", () => {
  const stdout = "TAP version 13\nok 1 - only test\n# tests 1\n# pass 1\n# fail 0\n";
  const result = parseNodeTestOutput(stdout, "", 0);
  assert.equal(result.total, 1);
  assert.equal(result.pass, 1);
  assert.equal(result.fail, 0);
  assert.deepEqual(result.failingNames, []);
});