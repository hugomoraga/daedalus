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

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectState } from "./types.ts";
import { parseSpecs, computeActivePhase } from "./parser/specs.ts";
import { parseSpecCompletion } from "./parser/completion.ts";

export function parseRepo(rootPath: string): ProjectState {
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

  // TODO PR-3: read governance/decisions/ADR-NNN-*.md + docs/roadmap.md.
  // TODO PR-4: list apps/, packages/, tests/; regex apps/cli/src/index.ts.
  // TODO PR-5: compute blocker graph + next-unlocks ranking.
  // TODO PR-6: runGitDiff(root).
  // TODO PR-7: runNpmTest(root).
  return {
    ...emptyState(root, now),
    specs,
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
    diff: {
      branch: null,
      commits: [],
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      entries: [],
      available: false,
      reason: "parser not yet wired (PR 3–7 pending)",
    },
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
