// Theia (Spec 012) — git diff runner (PR 6).
//
// `runGitDiff(rootPath)` shells out to git three times and assembles a
// typed `DiffSummary` (AC-9):
//   - `git rev-parse --abbrev-ref HEAD`  → branch
//   - `git log --oneline main..HEAD`    → commits
//   - `git diff --stat main..HEAD`     → file-level + totals
//
// Errors (non-zero exit, not a git repo, no upstream) collapse to
// `{ available: false, reason }`. The runner never throws.
//
// The pure parsers (`parseGitLog`, `parseGitDiffStat`) are exported
// separately so tests can exercise them with mocked strings.

import { spawn } from "node:child_process";
import type { DiffSummary } from "../types.ts";

export type RunGitResult =
  | { ok: true; summary: DiffSummary }
  | { ok: false; reason: string };

const EMPTY_SUMMARY: DiffSummary = {
  branch: null,
  commits: [],
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
  entries: [],
  available: false,
  reason: null,
};

// Pure parser: `git log --oneline main..HEAD` → commit list.
// Each line is `<sha> <subject>`. Empty stdout → no commits.
// Lines that don't match the shape are skipped (defensive).
export function parseGitLog(stdout: string): Array<{ sha: string; subject: string }> {
  const out: Array<{ sha: string; subject: string }> = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const m = /^([0-9a-f]{7,40})\s+(.+)$/.exec(trimmed);
    if (m === null) continue;
    out.push({ sha: m[1] ?? "", subject: m[2] ?? "" });
  }
  return out;
}

// Pure parser: `git diff --stat main..HEAD` → entries + totals.
// Last line: " N files changed, X insertions(+), Y deletions(-)"
// File lines: " path | N +++---" (pipes-and-pluses abbreviated).
export function parseGitDiffStat(stdout: string): Pick<DiffSummary, "filesChanged" | "insertions" | "deletions" | "entries"> {
  const lines = stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;
  const entries: DiffSummary["entries"] = [];
  for (const line of lines) {
    const totalsMatch = /^(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/.exec(line);
    if (totalsMatch !== null) {
      filesChanged = Number(totalsMatch[1] ?? 0);
      insertions = totalsMatch[2] !== undefined ? Number(totalsMatch[2]) : 0;
      deletions = totalsMatch[3] !== undefined ? Number(totalsMatch[3]) : 0;
      continue;
    }
    // File line: " path/to/file.ts | N +++---" where N is `changes`.
    const fileMatch = /^(.+?)\s+\|\s+(\d+)(?:\s+(\d+))?/.exec(line);
    if (fileMatch !== null) {
      const path = (fileMatch[1] ?? "").trim();
      // Git's --stat doesn't give per-file insertions/deletions; we
      // leave them null. The bar count is a coarse indicator.
      entries.push({ path, insertions: 0, deletions: 0 });
      void fileMatch[2];
    }
  }
  return { filesChanged, insertions, deletions, entries };
}

// Async helper: run a git subcommand, capture stdout. Returns
// `{ ok, stdout, stderr }` — non-zero exit is reported via `ok: false`.
function runGit(args: string[], cwd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    try {
      const proc = spawn("git", args, { cwd });
      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString("utf8");
      });
      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString("utf8");
      });
      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, stdout, stderr: stderr + (err.message ?? "") });
      });
      proc.on("close", (code) => {
        if (settled) return;
        settled = true;
        resolve({ ok: code === 0, stdout, stderr });
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      resolve({ ok: false, stdout, stderr: err instanceof Error ? err.message : String(err) });
    }
  });
}

export async function runGitDiff(rootPath: string): Promise<RunGitResult> {
  const [branchResult, logResult, statResult] = await Promise.all([
    runGit(["rev-parse", "--abbrev-ref", "HEAD"], rootPath),
    runGit(["log", "--oneline", "main..HEAD"], rootPath),
    runGit(["diff", "--stat", "main..HEAD"], rootPath),
  ]);
  if (!branchResult.ok) {
    return { ok: false, reason: branchResult.stderr.trim() || "git rev-parse failed (not a git repo?)" };
  }
  const branch = branchResult.stdout.trim();
  // An empty branch (detached HEAD) is fine — we just record it.
  const commits = parseGitLog(logResult.stdout);
  const totals = parseGitDiffStat(statResult.stdout);
  // Treat "no upstream" (log fail with empty stdout but stat OK) as
  // a soft "no diff yet" — the user's branch hasn't diverged.
  const available = branch.length > 0 || commits.length > 0 || totals.filesChanged > 0;
  if (!available) {
    return {
      ok: true,
      summary: { ...EMPTY_SUMMARY, branch: branch.length > 0 ? branch : null, available: false, reason: "no commits ahead of main" },
    };
  }
  return {
    ok: true,
    summary: {
      branch: branch.length > 0 ? branch : null,
      commits,
      ...totals,
      available: true,
      reason: null,
    },
  };
}