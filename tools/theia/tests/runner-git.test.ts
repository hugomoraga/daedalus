// Theia (Spec 012) — git diff runner tests (PR 6).
//
// Covers AC-9 (Diff summary: branch + commits + stat). Pure parsers
// are exercised with mocked strings; the async runner is exercised
// against the live repo (which IS a git repo).

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  parseGitLog,
  parseGitDiffStat,
  runGitDiff,
} from "../src/runners/git.ts";

test("AC-9: parseGitLog extracts the commit list from `git log --oneline`", () => {
  const log = "abc1234 First commit subject\ndef5678 Second commit subject\na9b8c7d Third one\n";
  const commits = parseGitLog(log);
  assert.equal(commits.length, 3);
  assert.equal(commits[0]!.sha, "abc1234");
  assert.equal(commits[0]!.subject, "First commit subject");
  assert.equal(commits[2]!.sha, "a9b8c7d");
  assert.equal(commits[2]!.subject, "Third one");
});

test("AC-9: parseGitLog tolerates empty stdout (no commits ahead of main)", () => {
  assert.deepEqual(parseGitLog(""), []);
  assert.deepEqual(parseGitLog("\n\n\n"), []);
});

test("AC-9: parseGitLog skips malformed lines defensively", () => {
  const log = "abc1234 Good line\nnot-a-sha-line\ndef5678 Another good line\n";
  const commits = parseGitLog(log);
  assert.equal(commits.length, 2);
});

test("AC-9: parseGitDiffStat extracts file-level + totals", () => {
  const stat = [
    " file1.ts                         | 10 +++++-----",
    " file2.ts                         |  5 +++++",
    " 2 files changed, 15 insertions(+), 5 deletions(-)",
  ].join("\n");
  const result = parseGitDiffStat(stat);
  assert.equal(result.filesChanged, 2);
  assert.equal(result.insertions, 15);
  assert.equal(result.deletions, 5);
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0]!.path, "file1.ts");
  assert.equal(result.entries[1]!.path, "file2.ts");
});

test("AC-9: parseGitDiffStat handles empty stdout (no diff)", () => {
  const result = parseGitDiffStat("");
  assert.equal(result.filesChanged, 0);
  assert.equal(result.insertions, 0);
  assert.equal(result.deletions, 0);
  assert.deepEqual(result.entries, []);
});

test("AC-9: parseGitDiffStat handles 'X files changed' with no insertions/deletions", () => {
  const stat = "1 file changed, 0 insertions(+), 0 deletions(-)\n";
  const result = parseGitDiffStat(stat);
  assert.equal(result.filesChanged, 1);
  assert.equal(result.insertions, 0);
  assert.equal(result.deletions, 0);
});

test("AC-9: runGitDiff on the live repo returns a real summary", async () => {
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const result = await runGitDiff(repoRoot);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const { summary } = result;
  // Branch is set (the live repo is on some branch — main or a feature branch).
  assert.ok(summary.branch !== null);
  assert.ok(typeof summary.branch === "string" && summary.branch.length > 0);
  // Files changed + insertions + deletions are non-negative numbers.
  assert.ok(summary.filesChanged >= 0);
  assert.ok(summary.insertions >= 0);
  assert.ok(summary.deletions >= 0);
  // available is true when the branch is set (no commits ahead expected
  // on main, but the runner still marks available=true if branch is non-null).
  assert.ok(summary.available === true);
  assert.ok(summary.reason === null);
});

test("AC-9: runGitDiff on a non-git directory returns { ok: false, reason }", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "theia-non-git-"));
  const result = await runGitDiff(dir);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reason.length > 0);
});