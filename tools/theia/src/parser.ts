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
import type { ProjectState, TestResult } from "./types.ts";
import { parseSpecs, computeActivePhase } from "./parser/specs.ts";
import { parseSpecCompletion } from "./parser/completion.ts";
import { parseAdrs } from "./parser/adrs.ts";
import { parsePhases } from "./parser/phases.ts";
import { parseCodeInventory } from "./parser/inventory.ts";
import { parseUseCases } from "./parser/use-cases.ts";
import { parseBlockers, computeNextUnlocks } from "./parser/blockers.ts";
import { parseBacklog } from "./parser/backlog.ts";
import { runGitDiff } from "./runners/git.ts";
import { runNpmTest } from "./runners/tests.ts";

// Returned alongside the ProjectState. `pendingTests` is the npm-test
// promise (fire-and-forget; resolves when the subprocess closes).
// Callers can `await pendingTests` to get the final TestResult, or
// ignore it and render the `running: true` placeholder.
export type ParseRepoResult = {
  state: ProjectState;
  pendingTests: Promise<TestResult>;
};

export async function parseRepo(rootPath: string): Promise<ParseRepoResult> {
  const root = resolve(rootPath);
  const exists = existsSync(root) && statSync(root).isDirectory();
  const now = new Date().toISOString();
  if (!exists) {
    const pending = Promise.resolve(emptyTestResult("not in a git repo or path missing"));
    return { state: emptyState(root, now), pendingTests: pending };
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
  const backlog = parseBacklog(root);

  // PR 5: blocker graph + next-unlocks.
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

  // PR 6: git diff runner (AC-9).
  const diffResult = await runGitDiff(root);
  const diff = diffResult.ok ? diffResult.summary : { ...emptyDiff(), reason: diffResult.reason };

  // PR 7: npm test runner (AC-8). Fire-and-forget: the parser
  // returns immediately with `running: true`; the server (PR 8) or
  // any caller can `await pendingTests` to get the final result.
  const controller = runNpmTest(root);
  const tests: TestResult = {
    running: true,
    total: null,
    pass: null,
    fail: null,
    failingNames: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    reason: null,
  };

  return {
    state: {
      rootPath: root,
      computedAt: now,
      specs,
      adrs,
      phases,
      codeInventory,
      useCases,
      blockers,
      nextUnlocks,
      diff,
      tests,
      backlog,
      activePhase,
    },
    pendingTests: controller.result,
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
    tests: emptyTestResult("parser not yet wired (PR 7 pending)"),
    backlog: [],
  };
}

function emptyTestResult(reason: string): TestResult {
  return {
    running: false,
    total: null,
    pass: null,
    fail: null,
    failingNames: [],
    startedAt: null,
    completedAt: null,
    reason,
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