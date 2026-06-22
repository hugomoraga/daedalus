// Verification script — prints per-spec counts from the live repo.
// Run with: node tools/theia/scripts/verify-spec-counts.mjs (or similar).

import { parseSpecs } from "../src/parser/specs.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

const cards = parseSpecs(root);
console.log("Slug".padEnd(38) + "Status".padEnd(14) + "Tasks".padEnd(12) + "Plan".padEnd(12) + "Issues");
for (const c of cards) {
  const tasks = c.tasksTotal === 0 ? "(none)" : `${c.tasksDone}/${c.tasksTotal}`;
  const plan = c.planTotal === 0 ? "(none)" : `${c.planDone}/${c.planTotal}`;
  const issues = c.conventionIssues.length === 0 ? "" : c.conventionIssues.join("; ");
  console.log(c.slug.padEnd(38) + c.status.padEnd(14) + tasks.padEnd(12) + plan.padEnd(12) + issues);
}

console.log(`\nTotal: ${cards.length} specs.`);
const totalTasksDone = cards.reduce((s, c) => s + c.tasksDone, 0);
const totalTasksTotal = cards.reduce((s, c) => s + c.tasksTotal, 0);
const totalPlanDone = cards.reduce((s, c) => s + c.planDone, 0);
const totalPlanTotal = cards.reduce((s, c) => s + c.planTotal, 0);
console.log(`Tasks: ${totalTasksDone}/${totalTasksTotal}  Plan: ${totalPlanDone}/${totalPlanTotal}`);

const driftCount = cards.filter((c) => c.conventionIssues.length > 0).length;
console.log(`Drift: ${driftCount} specs need attention.`);