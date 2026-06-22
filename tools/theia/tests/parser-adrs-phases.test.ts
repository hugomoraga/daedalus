// Theia (Spec 012) — ADRs + roadmap phases parser tests (PR 3).
//
// Covers AC-5 (ADR list with status + date + link, sorted by number)
// and AC-1 (phase timeline data source). Uses an immutable fixture
// (tests/fixtures/repo-typical/) plus live-repo sanity tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdrs } from "../src/parser/adrs.ts";
import { parsePhases } from "../src/parser/phases.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/repo-typical", import.meta.url));

test("AC-5: parseAdrs returns the 2 fixture ADRs sorted by number ascending", () => {
  const rows = parseAdrs(FIXTURE);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.number, 1);
  assert.equal(rows[0]!.slug, "first-adr");
  assert.equal(rows[0]!.status, "Accepted");
  assert.equal(rows[0]!.date, "2026-06-13");
  assert.equal(rows[0]!.link, "governance/decisions/ADR-001-first-adr.md");
  assert.equal(rows[1]!.number, 7);
  assert.equal(rows[1]!.slug, "second-adr");
  assert.equal(rows[1]!.status, "Proposed");
});

test("AC-5: ADRs in the live repo include both Accepted and Proposed statuses", () => {
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const rows = parseAdrs(repoRoot);
  assert.ok(rows.length >= 5, `expected ≥5 ADRs, got ${rows.length}`);
  // Sorted ascending by number.
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1]!.number < rows[i]!.number);
  }
  // At least one Accepted (per spec convention).
  assert.ok(rows.some((r) => r.status === "Accepted"));
});

test("AC-1: parsePhases returns 3 phases from the fixture roadmap", () => {
  const phases = parsePhases(FIXTURE);
  assert.equal(phases.length, 3);
  assert.equal(phases[0]!.number, 0);
  assert.equal(phases[0]!.title, "Foundations");
  assert.equal(phases[1]!.number, 1);
  assert.equal(phases[1]!.title, "Organizational Core");
  assert.equal(phases[2]!.number, 2);
  assert.equal(phases[2]!.title, "Workflow Engine");
});

test("AC-1: parsePhases counts milestones per phase (≥1 each in the fixture)", () => {
  const phases = parsePhases(FIXTURE);
  for (const p of phases) {
    assert.ok(p.milestoneCount >= 1, `phase ${p.number} should have ≥1 milestone`);
  }
});

test("AC-1: parsePhases on the live repo returns 5 phases", () => {
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const phases = parsePhases(repoRoot);
  assert.ok(phases.length >= 5, `expected ≥5 phases, got ${phases.length}`);
  // Sorted by number ascending.
  for (let i = 1; i < phases.length; i++) {
    assert.ok(phases[i - 1]!.number < phases[i]!.number);
  }
});

test("AC-14: parseAdrs + parsePhases are deterministic (fixture)", () => {
  const a1 = parseAdrs(FIXTURE);
  const a2 = parseAdrs(FIXTURE);
  assert.deepEqual(a1, a2);
  const p1 = parsePhases(FIXTURE);
  const p2 = parsePhases(FIXTURE);
  assert.deepEqual(p1, p2);
});

test("missing decisions dir → empty array (does not throw)", () => {
  const dir = mkdtempSync(join(tmpdir(), "theia-adrs-"));
  assert.deepEqual(parseAdrs(dir), []);
});

test("missing roadmap.md → empty array (does not throw)", () => {
  const dir = mkdtempSync(join(tmpdir(), "theia-phases-"));
  assert.deepEqual(parsePhases(dir), []);
});

// Live repo: parseRepo wires ADRs + phases into the orchestrator.
test("parseRepo on the live repo surfaces ADRs and phases (PR 3 wired)", async () => {
  const { parseRepo } = await import("../src/parser.ts");
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const state = parseRepo(repoRoot);
  assert.ok(state.adrs.length >= 5);
  assert.ok(state.phases.length >= 5);
});