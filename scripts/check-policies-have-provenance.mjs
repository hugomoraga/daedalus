#!/usr/bin/env node
// Spec 009 Plan §7 — lint: every policy JSON under config/policies/ must
// have a provenance block with required fields. Mirrors the Spec 008
// check-rulesets-have-provenance.mjs.
//
// Wired into `npm test` via the `lint:policies-have-provenance` script.
// Exits 0 on success, 1 on failure.

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const root = join(repoRoot, "config", "policies");

if (!existsSync(root)) {
  console.log("lint:policies-have-provenance OK (no policies dir)");
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
  checkProvenance(parsed.ref.provenance, "ref.provenance", file);
  if (!Array.isArray(parsed.rules)) {
    errors.push(`${file}: missing "rules" array`);
    continue;
  }
  for (const [i, rule] of parsed.rules.entries()) {
    if (rule === null || typeof rule !== "object") {
      errors.push(`${file}: rules[${i}] not an object`);
      continue;
    }
    if (typeof rule.ruleId !== "string" || rule.ruleId.trim().length === 0) {
      errors.push(`${file}: rules[${i}].ruleId missing or empty`);
    }
    if (rule.match === null || typeof rule.match !== "object") {
      errors.push(`${file}: rules[${i}].match missing`);
    }
    if (rule.outcome !== "allow" && rule.outcome !== "deny" && rule.outcome !== "escalate") {
      errors.push(`${file}: rules[${i}].outcome must be allow|deny|escalate, got "${rule.outcome}"`);
    }
    if (rule.outcome === "escalate" && (rule.escalateTo === undefined || rule.escalateTo.trim().length === 0)) {
      errors.push(`${file}: rules[${i}].escalateTo required when outcome=escalate`);
    }
  }
}

if (errors.length > 0) {
  console.error("POLICY PROVENANCE / SHAPE ERRORS:");
  for (const e of errors) console.error(`  ${e}`);
  console.error("");
  console.error("Every policy must carry provenance with sourceKind, sourceId,");
  console.error("retrievedAt (ISO date), and verifiedBy. Every rule must have");
  console.error("ruleId, match, and outcome (allow|deny|escalate). escalate rules");
  console.error("also need escalateTo. See Spec 009 §3.3 + §3.2.");
  process.exit(1);
}

console.log("lint:policies-have-provenance OK");