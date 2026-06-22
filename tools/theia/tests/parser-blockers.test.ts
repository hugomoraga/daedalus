// Theia (Spec 012) — blocker graph + next-unlocks tests (PR 5).
//
// Covers AC-10 (Blocked-by list + Next-unlocks ranking). Uses the
// `repo-blocked/` fixture: 1 BLOCKED spec with 2 unblockers + 1
// Ratified spec (which must NOT appear in next-unlocks).

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  parseBlockers,
  computeNextUnlocks,
} from "../src/parser/blockers.ts";
import type { SpecCard } from "../src/types.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE = fileURLToPath(new URL("./fixtures/repo-blocked", import.meta.url));

function loadFixtureCards(): SpecCard[] {
  // Build minimal SpecCard fixtures matching the file system.
  const slugs = ["100-blocked", "101-unblocker-a", "102-unblocker-b", "103-already-shipped"];
  const cards: SpecCard[] = [];
  for (const slug of slugs) {
    const content = readFileSync(join(FIXTURE, "specs", slug, "spec.md"), "utf8");
    const statusLine = content.match(/^\*\*Status:\*\*\s+(.+?)\s*$/m);
    const status = statusLine?.[1]?.split(/\s+/, 1)[0] as SpecCard["status"];
    cards.push({
      slug,
      title: slug,
      status,
      statusTail: statusLine?.[1] ?? "",
      phase: null,
      version: null,
      lastUpdated: null,
      summaryPreview: "",
      tasksDone: 0,
      tasksTotal: 0,
      planDone: 0,
      planTotal: 0,
      links: { spec: `specs/${slug}/spec.md`, plan: null, tasks: null },
      unknownReason: null,
      blockers: [],
    });
  }
  return cards;
}

test("AC-10: parseBlockers extracts the 2 unblockers from the BLOCKED fixture", () => {
  const cards = loadFixtureCards();
  const contents = new Map<string, string>();
  for (const slug of cards.map((c) => c.slug)) {
    contents.set(slug, readFileSync(join(FIXTURE, "specs", slug, "spec.md"), "utf8"));
  }
  parseBlockers(cards, contents);
  const blocked = cards.find((c) => c.slug === "100-blocked");
  assert.ok(blocked !== undefined);
  assert.equal(blocked.blockers.length, 2);
  // Both are specs (no ADRs in this fixture).
  assert.ok(blocked.blockers.every((b) => b.unblockerKind === "spec"));
  // Slugs are preserved.
  const slugs = blocked.blockers.map((b) => b.unblockerSlug);
  assert.ok(slugs.includes("101"));
  assert.ok(slugs.includes("102"));
});

test("AC-10: parseBlockers tolerates a spec without `**Unblocked by:**` (no inference)", () => {
  // Spec 101 has no Unblocked-by line; its blockers list stays empty.
  const cards = loadFixtureCards();
  const contents = new Map<string, string>();
  for (const slug of cards.map((c) => c.slug)) {
    contents.set(slug, readFileSync(join(FIXTURE, "specs", slug, "spec.md"), "utf8"));
  }
  parseBlockers(cards, contents);
  const a = cards.find((c) => c.slug === "101-unblocker-a");
  assert.ok(a !== undefined);
  assert.equal(a.blockers.length, 0);
});

test("AC-10: computeNextUnlocks ranks 101 + 102 each with unlocksCount=1", () => {
  const cards = loadFixtureCards();
  const contents = new Map<string, string>();
  for (const slug of cards.map((c) => c.slug)) {
    contents.set(slug, readFileSync(join(FIXTURE, "specs", slug, "spec.md"), "utf8"));
  }
  parseBlockers(cards, contents);
  const ranking = computeNextUnlocks(cards);
  // Both unblockers appear with count=1.
  const a = ranking.find((r) => r.slug === "101");
  const b = ranking.find((r) => r.slug === "102");
  assert.ok(a !== undefined && b !== undefined);
  assert.equal(a.unlocksCount, 1);
  assert.equal(b.unlocksCount, 1);
  // Ratified spec 103 must NOT appear.
  assert.equal(ranking.find((r) => r.slug === "103"), undefined);
});

test("AC-10: computeNextUnlocks sorts by count desc then slug asc", () => {
  // Build a fixture with one BLOCKED spec listing two unblockers
  // and a second BLOCKED spec listing one — verifies the count
  // drives ordering.
  const cards: SpecCard[] = [
    {
      slug: "100-blocked",
      title: "blocked",
      status: "Blocked",
      statusTail: "",
      phase: null,
      version: null,
      lastUpdated: null,
      summaryPreview: "",
      tasksDone: 0,
      tasksTotal: 0,
      planDone: 0,
      planTotal: 0,
      links: { spec: "x", plan: null, tasks: null },
      unknownReason: null,
      blockers: [
        { unblockerSlug: "200", unblockerKind: "spec" },
        { unblockerSlug: "201", unblockerKind: "spec" },
      ],
    },
    {
      slug: "101-blocked",
      title: "blocked2",
      status: "Blocked",
      statusTail: "",
      phase: null,
      version: null,
      lastUpdated: null,
      summaryPreview: "",
      tasksDone: 0,
      tasksTotal: 0,
      planDone: 0,
      planTotal: 0,
      links: { spec: "x", plan: null, tasks: null },
      unknownReason: null,
      blockers: [{ unblockerSlug: "200", unblockerKind: "spec" }],
    },
  ];
  const ranking = computeNextUnlocks(cards);
  // 200 unlocks 2 specs (highest); 201 unlocks 1.
  assert.equal(ranking[0]?.slug, "200");
  assert.equal(ranking[0]?.unlocksCount, 2);
  assert.equal(ranking[1]?.slug, "201");
  assert.equal(ranking[1]?.unlocksCount, 1);
});

test("AC-14: parseBlockers is deterministic (fixture)", () => {
  const cards = loadFixtureCards();
  const contents = new Map<string, string>();
  for (const slug of cards.map((c) => c.slug)) {
    contents.set(slug, readFileSync(join(FIXTURE, "specs", slug, "spec.md"), "utf8"));
  }
  const a = cards.map((c) => ({ ...c, blockers: [...c.blockers] }));
  const b = cards.map((c) => ({ ...c, blockers: [...c.blockers] }));
  parseBlockers(a, contents);
  parseBlockers(b, contents);
  assert.deepEqual(a, b);
});

// Live-repo sanity: parseRepo wires blockers + nextUnlocks.
test("parseRepo on the live repo surfaces blockers + nextUnlocks (PR 5 wired)", async () => {
  const { parseRepo } = await import("../src/parser.ts");
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const state = parseRepo(repoRoot);
  // The live repo currently has no BLOCKED specs (post-004 build), but
  // the surfaces must be present (typed shape stable).
  assert.ok(Array.isArray(state.blockers));
  assert.ok(Array.isArray(state.nextUnlocks));
});