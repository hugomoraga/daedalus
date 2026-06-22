// Theia (Spec 012) — code inventory + use cases parser tests (PR 4).
//
// Covers AC-6 (code inventory — apps/, packages/, tests/) and AC-7
// (CLI use cases extracted from per-command files; sorted
// alphabetically). Uses an immutable fixture
// (tests/fixtures/repo-typical/) plus live-repo sanity tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCodeInventory } from "../src/parser/inventory.ts";
import { parseUseCases } from "../src/parser/use-cases.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/repo-typical", import.meta.url));

test("AC-6: parseCodeInventory returns the fixture's apps + packages (no tests/.test.ts yet)", () => {
  const inventory = parseCodeInventory(FIXTURE);
  // The fixture has apps/cli + apps/atlas + apps/some-other-app + packages/some-pkg.
  // No top-level *.test.ts files yet (added by PR 2 tests).
  const apps = inventory.filter((e) => e.kind === "app");
  const packages = inventory.filter((e) => e.kind === "package");
  assert.ok(apps.length >= 3);
  assert.ok(packages.length >= 1);
  // cli is in there.
  assert.ok(apps.some((e) => e.name === "cli"));
  // Links are relative paths.
  for (const e of inventory) {
    assert.ok(e.link.startsWith("apps/") || e.link.startsWith("packages/") || e.link.startsWith("tests/"));
  }
});

test("AC-6: parseCodeInventory entries are sorted alphabetically within each kind", () => {
  const inventory = parseCodeInventory(FIXTURE);
  const apps = inventory.filter((e) => e.kind === "app").map((e) => e.name);
  const sorted = [...apps].sort();
  assert.deepEqual(apps, sorted);
});

test("AC-7: parseUseCases extracts the 5 fixture CLI commands sorted alphabetically", () => {
  const useCases = parseUseCases(FIXTURE);
  assert.equal(useCases.length, 5);
  assert.deepEqual(
    useCases.map((u) => u.command),
    ["alpha:create", "beta:list", "delta:status", "epsilon:run", "gamma:delete"],
  );
  // Each link points into the commands dir.
  for (const u of useCases) {
    assert.match(u.link, /^apps\/cli\/src\/commands\/.+\.ts$/);
  }
});

test("AC-7: parseUseCases on the live repo surfaces all real CLI commands", () => {
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const useCases = parseUseCases(repoRoot);
  assert.ok(useCases.length >= 20, `expected ≥20 commands, got ${useCases.length}`);
  // Sorted alphabetically.
  for (let i = 1; i < useCases.length; i++) {
    assert.ok(useCases[i - 1]!.command.localeCompare(useCases[i]!.command) <= 0);
  }
  // Spot-check a known command (from the live repo).
  assert.ok(useCases.some((u) => u.command === "lead:create"));
  assert.ok(useCases.some((u) => u.command === "obligations:list"));
});

test("missing apps/cli/src/commands dir → empty array (does not throw)", () => {
  const dir = mkdtempSync(join(tmpdir(), "theia-cli-"));
  assert.deepEqual(parseUseCases(dir), []);
});

test("missing apps/ + packages/ + tests/ → empty array (does not throw)", () => {
  const dir = mkdtempSync(join(tmpdir(), "theia-inv-"));
  assert.deepEqual(parseCodeInventory(dir), []);
});

test("parseUseCases tolerates `case \"...\":` legacy pattern (Plan §2 fallback)", () => {
  // The parser is built to handle both `[ "name",` (per-command
  // files, post PR #34) AND `case "name":` (legacy inline switch).
  // This test pins both shapes via a small inline fixture.
  const base = mkdtempSync(join(tmpdir(), "theia-legacy-"));
  const cliCommandsDir = join(base, "apps", "cli", "src", "commands");
  mkdirSync(cliCommandsDir, { recursive: true });
  writeFileSync(
    join(cliCommandsDir, "legacy.ts"),
    `export const handlers = [\n  ["legacy:cmd", null],\n];\n  case "legacy:inline": handle();\n`,
  );
  const useCases = parseUseCases(base);
  assert.ok(useCases.some((u) => u.command === "legacy:cmd"));
  assert.ok(useCases.some((u) => u.command === "legacy:inline"));
});

// Live repo: parseRepo wires inventory + useCases into the orchestrator.
test("parseRepo on the live repo surfaces inventory + useCases (PR 4 wired)", async () => {
  const { parseRepo } = await import("../src/parser.ts");
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const state = parseRepo(repoRoot);
  assert.ok(state.codeInventory.length > 0, "live repo has apps + packages");
  assert.ok(state.useCases.length >= 20, "live repo has many CLI commands");
});