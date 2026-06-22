#!/usr/bin/env node
// Spec 008 Plan §6 — lint: every rule-set JSON under config/rulesets/ must
// have a provenance block with required fields, and every obligation must
// also have a provenance. Walks config/rulesets/**/*.json.
//
// Wired into `npm test` via the `lint:rulesets-have-provenance` script.
// Exits 0 on success, 1 on failure.

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const root = join(repoRoot, "config", "rulesets");

if (!existsSync(root)) {
  // No rulesets directory yet — nothing to lint.
  console.log("lint:rulesets-have-provenance OK (no rulesets dir)");
  process.exit(0);
}

const REQUIRED = ["sourceKind", "sourceId", "retrievedAt", "verifiedBy"];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".gitkeep" || entry.name === "README.md") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && full.endsWith(".json")) yield full;
  }
}

const errors = [];

function checkProvenance(p, label, file) {
  if (p === null || typeof p !== "object") {
    errors.push(`${file}: ${label} is missing`);
    return;
  }
  for (const f of REQUIRED) {
    if (typeof p[f] !== "string" || p[f].trim().length === 0) {
      errors.push(`${file}: ${label}.${f} missing or empty`);
    }
  }
  if (typeof p.retrievedAt === "string" && !/^\d{4}-\d{2}-\d{2}/.test(p.retrievedAt)) {
    errors.push(`${file}: ${label}.retrievedAt not ISO date: "${p.retrievedAt}"`);
  }
}

for await (const file of walk(root)) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    errors.push(`${file}: malformed JSON (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  if (parsed === null || typeof parsed !== "object") {
    errors.push(`${file}: not an object`);
    continue;
  }
  if (parsed.ref === null || typeof parsed.ref !== "object") {
    errors.push(`${file}: missing "ref" object`);
    continue;
  }
  checkProvenance(parsed.ref.source, "ref.source", file);
  if (!Array.isArray(parsed.obligations)) {
    errors.push(`${file}: missing "obligations" array`);
    continue;
  }
  for (const [i, obligation] of parsed.obligations.entries()) {
    if (obligation === null || typeof obligation !== "object") {
      errors.push(`${file}: obligations[${i}] not an object`);
      continue;
    }
    checkProvenance(
      obligation.provenance,
      `obligations[${i}].provenance`,
      file,
    );
  }
}

if (errors.length > 0) {
  console.error("RULESET PROVENANCE ERRORS:");
  for (const e of errors) console.error(`  ${e}`);
  console.error("");
  console.error("Every rule must carry provenance with sourceKind, sourceId,");
  console.error("retrievedAt (ISO date), and verifiedBy. See Spec 008 §3.3.");
  process.exit(1);
}

console.log("lint:rulesets-have-provenance OK");