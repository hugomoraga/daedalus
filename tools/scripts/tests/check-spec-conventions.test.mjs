// Linter tests for tools/scripts/check-spec-conventions.mjs (Spec 015
// §6 AC-3). Each test scaffolds a minimal specs/ directory in a
// mkdtemp, runs the linter as a child process with `cwd` set to that
// directory, and asserts on the exit code + stderr/stdout.
//
// Test layout mirrors the AC-3 matrix in Plan 015 §8:
//   - missing tasks.md                  → FAIL
//   - empty tasks.md (non-Draft)        → FAIL
//   - malformed task ID                 → WARN
//   - unknown Status word               → FAIL
//   - canonical (Ratified + checkboxes) → PASS
//   - canonical (Draft + empty tasks)   → PASS

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const LINTER = new URL("../check-spec-conventions.mjs", import.meta.url).pathname;

function makeTmpRepo() {
  return mkdtempSync(join(tmpdir(), "daedalus-lint-"));
}

function writeSpec(repoRoot, slug, { specStatus, tasksContent, specExtras = "", includeStatus = true }) {
  const dir = join(repoRoot, "specs", slug);
  mkdirSync(dir, { recursive: true });
  const statusLine = includeStatus ? `**Status:** ${specStatus}\n` : "";
  const specBody = `# Spec ${slug}

${statusLine}**Version:** 1.0.0
**Last updated:** 2026-06-22
${specExtras}
`;
  writeFileSync(join(dir, "spec.md"), specBody);
  if (tasksContent !== null) {
    writeFileSync(join(dir, "tasks.md"), tasksContent);
  }
}

function runLinter(repoRoot) {
  // The linter reads `process.cwd()` + `specs/`. Spawn with cwd =
  // the tmp repo root, no script args.
  const result = spawnSync("node", [LINTER], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runWithCleanup(fn) {
  const repo = makeTmpRepo();
  try {
    return fn(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

// ---- AC-3: failure modes ----

test("AC-3: fails when tasks.md is missing", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "001-ratified", {
      specStatus: "Ratified · Phase 1",
      tasksContent: null,
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 1, `expected FAIL, got ${r.exitCode}\n${r.stderr}`);
    assert.match(r.stderr, /tasks\.md is missing/);
    assert.match(r.stderr, /001-ratified/);
  });
});

test("AC-3: fails when tasks.md has 0 checkboxes for non-Draft status", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "002-ratified", {
      specStatus: "Ratified · Phase 1",
      tasksContent: "# Tasks\n\n> No tasks yet.\n",
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 1, `expected FAIL, got ${r.exitCode}\n${r.stderr}`);
    assert.match(r.stderr, /tasks\.md has 0 checkboxes/);
  });
});

test("AC-3: fails on unknown Status word", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "003-bad", {
      specStatus: "Wibble · Phase 1",
      tasksContent: "- [x] T-01: foo\n",
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /unrecognised status word: "Wibble"/);
  });
});

test("AC-3: fails when spec.md is missing", () => {
  runWithCleanup((repo) => {
    const dir = join(repo, "specs", "004-only-tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "tasks.md"), "- [x] T-01: foo\n");
    const r = runLinter(repo);
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /spec\.md is missing/);
  });
});

test("AC-3: fails when Status line is missing", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "005-no-status", {
      specStatus: "", // ignored when includeStatus=false
      tasksContent: "- [x] T-01: foo\n",
      includeStatus: false,
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /no '\*\*Status:\*\*' line/);
  });
});

// ---- AC-3: pass cases ----

test("AC-3: passes on canonical (Ratified + checkboxes)", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "100-ok", {
      specStatus: "Ratified · Phase 1",
      tasksContent: "# Tasks\n\n- [x] T-01: done (AC-1)\n- [ ] T-02: pending (AC-2)\n",
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 0, `expected OK, got ${r.exitCode}\n${r.stderr}`);
    assert.match(r.stdout, /lint:spec-conventions OK/);
  });
});

test("AC-3: passes on Draft status with empty tasks.md", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "101-draft", {
      specStatus: "Draft · Phase 0",
      tasksContent: "# Tasks\n\n> No tasks yet.\n",
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 0, `expected OK (Draft allows empty), got ${r.exitCode}\n${r.stderr}`);
  });
});

test("AC-3: passes on Superseded status without tasks.md", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "102-superseded", {
      specStatus: "Superseded · replaced by 999",
      tasksContent: null,
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 0);
  });
});

// ---- AC-3: warnings (informational, do not fail) ----

test("AC-3: warns on malformed task ID but still passes", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "200-warn", {
      specStatus: "Ratified · Phase 1",
      tasksContent: "- [x] T-66a: weird ID (AC-1)\n",
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 0, `expected OK (warning only), got ${r.exitCode}\n${r.stderr}`);
    assert.match(r.stderr, /task-id-shape/);
    assert.match(r.stderr, /T-66a/);
  });
});

// ---- Cross-spec behaviour ----

test("AC-3: scans every spec in the repo (mixed pass/fail → overall fail)", () => {
  runWithCleanup((repo) => {
    writeSpec(repo, "300-ok", {
      specStatus: "Ratified · Phase 1",
      tasksContent: "- [x] T-01: foo\n",
    });
    writeSpec(repo, "301-broken", {
      specStatus: "Ratified · Phase 1",
      tasksContent: null,
    });
    const r = runLinter(repo);
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /301-broken/);
    assert.match(r.stderr, /tasks\.md is missing/);
  });
});