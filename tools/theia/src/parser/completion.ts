// Theia (Spec 012) — task completion counter (PR 2).
//
// `countCheckboxes(content)` returns `{ done, total }` for a markdown
// file. `parseSpecCompletion(rootPath, slug)` reads both tasks.md and
// plan.md and returns the combined counts (Spec §7 AC-4: "A plan.md
// checkbox count is added to the total if both files exist").
//
// Markdown checkbox regex matches the GitHub-flavored pattern
// `- [x]` (case-insensitive on the x) and `- [ ]`. Only leading
// hyphens at line start; indented checkboxes count too (the regex is
// lenient on whitespace).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKBOX_RE = /^\s*-\s+\[(x|X| )\](?:\s|$)/gm;

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

export type SpecCompletion = CompletionCounts & {
  tasks: CompletionCounts;
  plan: CompletionCounts;
};

export function parseSpecCompletion(rootPath: string, slug: string): SpecCompletion {
  const tasksPath = join(rootPath, "specs", slug, "tasks.md");
  const planPath = join(rootPath, "specs", slug, "plan.md");
  const tasks = existsSync(tasksPath) ? countCheckboxes(readFileSync(tasksPath, "utf8")) : { done: 0, total: 0 };
  const plan = existsSync(planPath) ? countCheckboxes(readFileSync(planPath, "utf8")) : { done: 0, total: 0 };
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
