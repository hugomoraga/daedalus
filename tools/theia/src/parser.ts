// Theia (Spec 012) — pure parser of repo structured artifacts.
//
// `parseRepo(rootPath)` is the single pure function that turns a
// repository into a `ProjectState`. PR 1 ships the skeleton; PR 2 wires
// specs + tasks; PRs 3–7 fill ADRs, phases, code inventory, use cases,
// blockers, diff, and test results.
//
// AC-14: parser output is byte-deterministic for a given rootPath +
// filesystem snapshot. Each sub-parser is a pure function of
// (rootPath, filesystem contents). The `computedAt` timestamp is the
// only time-varying field; it varies per call and is therefore
// stripped in AC-14 tests.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProjectState } from "./types.ts";
import { parseSpecs, computeActivePhase } from "./parser/specs.ts";
import { parseSpecCompletion } from "./parser/completion.ts";
import { parseAdrs } from "./parser/adrs.ts";
import { parsePhases } from "./parser/phases.ts";
import { parseCodeInventory } from "./parser/inventory.ts";
import { parseUseCases } from "./parser/use-cases.ts";
import { parseBlockers, computeNextUnlocks } from "./parser/blockers.ts";
import { runGitDiff } from "./runners/git.ts";

export async function parseRepo(rootPath: string): Promise<ProjectState> {
  const root = resolve(rootPath);
  const exists = existsSync(root) && statSync(root).isDirectory();
  const now = new Date().toISOString();
  if (!exists) {
    return emptyState(root, now);
  }

  const specs = parseSpecs(root);
  for (const card of specs) {
    const c = parseSpecCompletion(root, card.slug);
    card.tasksDone = c.tasks.done;
    card.tasksTotal = c.tasks.total;
    card.planDone = c.plan.done;
    card.planTotal = c.plan.total;
  }
  const activePhase = computeActivePhase(specs);

  const adrs = parseAdrs(root);
  const phases = parsePhases(root);
  const codeInventory = parseCodeInventory(root);
  const useCases = parseUseCases(root);

  // PR 5: blocker graph + next-unlocks. parseSpecs already populated
  // card.blockers as `[]`; we re-read the spec contents to fill the
  // unblocker lists.
  const specContents = new Map<string, string>();
  for (const card of specs) {
    const path = join(root, "specs", card.slug, "spec.md");
    if (existsSync(path)) specContents.set(card.slug, readFileSync(path, "utf8"));
  }
  parseBlockers(specs, specContents);
  const nextUnlocks = computeNextUnlocks(specs);
  const blockers = specs
    .filter((s) => s.status === "Blocked" && s.blockers.length > 0)
    .map((s) => ({ blockedSlug: s.slug, unblockers: s.blockers }));

  // PR 6: git diff runner (AC-9). Errors collapse to
  // { available: false, reason } — the runner never throws.
  const diffResult = await runGitDiff(root);
  const diff = diffResult.ok
    ? diffResult.summary
    : { ...emptyDiff(), reason: diffResult.reason };

  // TODO PR-7: runNpmTest(root).
  return {
    ...emptyState(root, now),
    specs,
    adrs,
    phases,
    codeInventory,
    useCases,
    blockers,
    nextUnlocks,
    diff,
    activePhase,
  };
}

function emptyState(rootPath: string, computedAt: string): ProjectState {
  return {
    rootPath,
    computedAt,
    specs: [],
    adrs: [],
    useCases: [],
    codeInventory: [],
    phases: [],
    activePhase: 0,
    blockers: [],
    nextUnlocks: [],
    diff: emptyDiff(),
    tests: {
      running: false,
      total: null,
      pass: null,
      fail: null,
      failingNames: [],
      startedAt: null,
      completedAt: null,
      reason: "test runner not yet wired (PR 7 pending)",
    },
  };
}

function emptyDiff() {
  return {
    branch: null,
    commits: [],
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    entries: [],
    available: false,
    reason: "git diff not yet wired (PR 6 pending)",
  };
}
