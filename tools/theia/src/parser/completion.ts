// Theia (Spec 012 + Spec 015) — task completion counter.
//
// `countCheckboxes(content)` returns `{ done, total }` for a markdown
// file (Spec 015 §3 canonical format: `- [x]` / `- [ ]`).
//
// `countLegacyTableRows(content)` returns `{ done, total }` for the
// legacy emoji-table form (Spec 015 §6 AC-2: defensive fallback).
// Only fires when `countCheckboxes` returned 0 — canonical wins.
//
// `parseSpecCompletion(rootPath, slug)` reads both `tasks.md` and
// `plan.md` and returns the combined counts (Spec 012 AC-4 +
// Spec 015 §6 AC-2: legacy fallback per-file).
//
// Markdown checkbox regex matches the GitHub-flavoured pattern
// `- [x]` (case-insensitive on the x) and `- [ ]`. Only leading
// hyphens at line start; indented checkboxes count too (the regex is
// lenient on whitespace).
//
// Legacy table regex matches one table cell containing exactly one
// of the status glyphs `✅` / `⏸` / `⛔`. Each cell counts as one
// task: ✅ → done, ⏸ / ⛔ → pending.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKBOX_RE = /^\s*-\s+\[(x|X| )\](?:\s|$)/gm;
// Legacy table row with a status glyph. Counts one row per task;
// ✅ = done, ⏸ / ⛔ = pending. Header and separator rows have no
// glyph and are silently skipped.
const LEGACY_RE = /^\s*\|.*[✅⏸⛔].*$/gm;

export type CompletionCounts = { done: number; total: number };

export function countCheckboxes(content: string): CompletionCounts {
  let done = 0;
  let total = 0;
  for (const match of content.matchAll(CHECKBOX_RE)) {
    const mark = match[1] ?? "";
    total += 1;
    if (mark !== "" && mark !== " ") done += 1;
  }
  return { done, total };
}

// Spec 015 §6 AC-2 — defensive back-compat for the legacy
// `| ✅ | / | ⏸ | / | ⛔ |` table form. Used by `parseSpecCompletion`
// only when the canonical checkbox count is zero. The legacy form is
// DEPRECATED; new specs MUST NOT use it (Spec 015 §7 R2).
export function countLegacyTableRows(content: string): CompletionCounts {
  let done = 0;
  let total = 0;
  for (const _match of content.matchAll(LEGACY_RE)) {
    total += 1;
    // We can't read the captured emoji from `_match[0]` directly because
    // the regex character class consumes the whole cell. Scan the line
    // for the specific emoji.
    const line = _match[0];
    if (line.includes("✅")) done += 1;
  }
  return { done, total };
}

export type SpecCompletion = CompletionCounts & {
  tasks: CompletionCounts;
  plan: CompletionCounts;
};

export function parseSpecCompletion(rootPath: string, slug: string): SpecCompletion {
  const tasksPath = join(rootPath, "specs", slug, "tasks.md");
  const planPath = join(rootPath, "specs", slug, "plan.md");
  const tasksContent = existsSync(tasksPath) ? readFileSync(tasksPath, "utf8") : "";
  const planContent = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";

  // Spec 015 §6 AC-1 + AC-2: canonical wins. Legacy fires only when
  // the canonical count is zero (i.e. the file has NO checkboxes at
  // all). A file with even one `- [x]` resolves to canonical counts.
  const tasksCanonical = countCheckboxes(tasksContent);
  const tasks = tasksCanonical.total > 0
    ? tasksCanonical
    : (existsSync(tasksPath) ? countLegacyTableRows(tasksContent) : { done: 0, total: 0 });

  const planCanonical = countCheckboxes(planContent);
  const plan = planCanonical.total > 0
    ? planCanonical
    : (existsSync(planPath) ? countLegacyTableRows(planContent) : { done: 0, total: 0 });

  return {
    done: tasks.done + plan.done,
    total: tasks.total + plan.total,
    tasks,
    plan,
  };
}

// Pure: counts in both files; missing files → 0/0.
export function mergeCompletion(a: CompletionCounts, b: CompletionCounts): CompletionCounts {
  return { done: a.done + b.done, total: a.total + b.total };
}