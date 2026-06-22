// Theia (Spec 012) — pure parser of repo structured artifacts.
//
// `parseRepo(rootPath)` is the single pure function that turns a
// repository into a `ProjectState`. Later PRs fill the parser phases;
// PR 1 ships the skeleton so downstream runners + views can be wired
// against a stable shape (AC-14: parser output is byte-deterministic
// for a given rootPath + filesystem snapshot).
//
// Phase markers (replaced in later PRs):
//   - parseSpecs            → PR 2
//   - parseAdrs             → PR 3
//   - parsePhases           → PR 3
//   - parseCodeInventory    → PR 4
//   - parseUseCases         → PR 4
//   - parseBlockers         → PR 5
//
// Runners (also pure, take rootPath + return typed value):
//   - runGitDiff            → PR 6
//   - runNpmTest            → PR 7

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectState } from "./types.ts";

export function parseRepo(rootPath: string): ProjectState {
  const root = resolve(rootPath);
  // Defensive: the parser only walks the filesystem; if the path is bad,
  // we return an empty state with `computedAt` set. Downstream views
  // render a clear "no repo found" message in this case.
  const exists = existsSync(root) && statSync(root).isDirectory();
  const now = new Date().toISOString();
  if (!exists) {
    return emptyState(root, now);
  }
  // TODO PR-2: read specs/NNN-*/spec.md + tasks.md + plan.md.
  // TODO PR-3: read governance/decisions/ADR-NNN-*.md + docs/roadmap.md.
  // TODO PR-4: list apps/, packages/, tests/; regex apps/cli/src/index.ts.
  // TODO PR-5: compute blocker graph + next-unlocks ranking.
  // TODO PR-6: runGitDiff(root).
  // TODO PR-7: runNpmTest(root).
  return emptyState(root, now);
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
      reason: "parser not yet wired (PR 2–7 pending)",
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
