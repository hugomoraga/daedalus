#!/usr/bin/env node
// Spec 015 — linter for spec files.
//
// Walks specs/NNN-* and fails CI if any spec violates the
// canonical format defined in Spec 015 §3 + tools/theia/CONVENTIONS.md.
//
// Wired into `npm test` via the `lint:spec-conventions` script and the
// `npm test` chain in package.json.
//
// Recognised spec statuses (first word of the `**Status:**` line in
// spec.md): Ratified · Draft · Blocked · Superseded · Planning · Shipped.
// Anything else fails (matches Theia's "Unknown" fallback).
//
// Exit codes:
//   0 — clean (or warnings only)
//   1 — at least one failure
//   2 — internal error (e.g. specs/ dir missing)
//
// Spec 015 §6 AC-3 + §4 R2: this linter is the source of enforcement.
// The parser's defensive back-compat for legacy emoji tables exists
// only for files that have zero checkboxes (Spec 015 §7 R2 mitigation).

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const specsDir = join(repoRoot, "specs");

if (!existsSync(specsDir)) {
  console.error(`specs directory not found: ${specsDir}`);
  process.exit(2);
}

const KNOWN_STATUSES = new Set([
  "Ratified",
  "Draft",
  "Blocked",
  "Superseded",
  "Planning",
  "Shipped",
]);

// Conventional task-ID prefixes. Accepts upper- and lower-case
// letters in the prefix. The numeric suffix is `NN` (2 digits) or
// `NN.N` (e.g. J-13.1). Trailing letters (e.g. AC-N, R1) are NOT
// task IDs — they're spec-level references. The linter warns on
// non-matching ID shapes but does not fail.
const TASK_ID_RE = /^[A-Z]{1,3}-\d+(?:\.\d+)?$/;
const CHECKBOX_RE = /^\s*-\s+\[(x|X| )\](?:\s|$)/gm;

const STATUS_LINE_RE = /^\*\*Status:\*\*\s+(.+?)\s*$/m;
const VERSION_LINE_RE = /^\*\*Version:\*\*\s+(.+?)\s*$/m;
const LAST_UPDATED_LINE_RE = /^\*\*Last updated:\*\*\s+(.+?)\s*$/m;

const failures = [];
const warnings = [];

function fail(slug, rule, msg) {
  failures.push({ slug, rule, msg });
}
function warn(slug, rule, msg) {
  warnings.push({ slug, rule, msg });
}

async function walkSpecs() {
  const entries = await readdir(specsDir, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!/^\d{3}-/.test(entry.name)) continue;
    slugs.push(entry.name);
  }
  slugs.sort();
  return slugs;
}

async function lintSpec(slug) {
  const dir = join(specsDir, slug);
  const specPath = join(dir, "spec.md");
  const tasksPath = join(dir, "tasks.md");

  if (!existsSync(specPath)) {
    fail(slug, "spec.md-missing", `spec.md is missing at ${specPath}`);
    return;
  }
  const specContent = await readFile(specPath, "utf8");

  const statusLine = specContent.match(STATUS_LINE_RE);
  if (statusLine === null) {
    fail(slug, "status-missing", `spec.md has no '**Status:**' line`);
    return;
  }
  const statusTail = statusLine[1].trim();
  const firstWord = statusTail.split(/\s+/, 1)[0] ?? "";
  if (!KNOWN_STATUSES.has(firstWord)) {
    fail(slug, "status-unknown", `unrecognised status word: "${firstWord}". Recognised: ${[...KNOWN_STATUSES].join(", ")}`);
  }

  if (specContent.match(VERSION_LINE_RE) === null) {
    warn(slug, "version-missing", `spec.md has no '**Version:**' line (informational)`);
  }
  if (specContent.match(LAST_UPDATED_LINE_RE) === null) {
    warn(slug, "last-updated-missing", `spec.md has no '**Last updated:**' line (informational)`);
  }

  // tasks.md is mandatory for non-Superseded specs.
  if (firstWord === "Superseded") return;
  if (!existsSync(tasksPath)) {
    fail(slug, "tasks-missing", `tasks.md is missing at ${tasksPath}`);
    return;
  }
  const tasksContent = await readFile(tasksPath, "utf8");
  const checkboxMatches = [...tasksContent.matchAll(CHECKBOX_RE)];
  if (checkboxMatches.length === 0 && firstWord !== "Draft") {
    fail(slug, "tasks-empty", `tasks.md has 0 checkboxes (allowed only when spec status is 'Draft')`);
  }

  // Warn on malformed task IDs (informational; not blocking).
  const taskIdLines = [...tasksContent.matchAll(/^\s*-\s+\[[ xX]\]\s+([A-Za-z0-9.\-]+):/gm)];
  for (const m of taskIdLines) {
    const id = m[1];
    if (!TASK_ID_RE.test(id)) {
      warn(slug, "task-id-shape", `task ID "${id}" doesn't match the conventional pattern (e.g. T-01, OF-12, J-13.1)`);
    }
  }
}

const slugs = await walkSpecs();
for (const slug of slugs) {
  await lintSpec(slug);
}

if (warnings.length > 0) {
  console.error(`lint:spec-conventions — ${warnings.length} warning(s):`);
  for (const w of warnings) {
    console.error(`  warn  ${w.slug} [${w.rule}] ${w.msg}`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error(`lint:spec-conventions — ${failures.length} FAILURE(s):`);
  for (const f of failures) {
    console.error(`  FAIL  ${f.slug} [${f.rule}] ${f.msg}`);
  }
  console.error("");
  console.error("See tools/theia/CONVENTIONS.md for the canonical format.");
  console.error("See specs/015-spec-file-convention/spec.md for the contract.");
  process.exit(1);
}

console.log(`lint:spec-conventions OK (${slugs.length} specs checked)`);