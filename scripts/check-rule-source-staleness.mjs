#!/usr/bin/env node
// Spec 010 Plan §7 — lint: every rule-set JSON under config/rulesets/ must
// have a provenance whose `retrievedAt` is not older than the configured
// staleness threshold (per sourceKind). Mirrors Spec 008's
// check-rulesets-have-provenance.mjs.
//
// Wired into `npm test` via the `lint:rule-source-staleness` script.
// Exits 0 on success, 1 on failure.

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const root = join(repoRoot, "config", "rulesets");

const DEFAULTS = {
  "official-publication": 12,
  "legal-advisor-opinion": 6,
  "tenant-declared": 3,
};

function envMonths(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const thresholds = {
  "official-publication": envMonths("TENANT_0_STALENESS_OFFICIAL_PUBLICATION_MONTHS", DEFAULTS["official-publication"]),
  "legal-advisor-opinion": envMonths("TENANT_0_STALENESS_LEGAL_ADVISOR_OPINION_MONTHS", DEFAULTS["legal-advisor-opinion"]),
  "tenant-declared": envMonths("TENANT_0_STALENESS_TENANT_DECLARED_MONTHS", DEFAULTS["tenant-declared"]),
};

function ageInMonths(retrievedAt) {
  const r = Date.parse(retrievedAt);
  if (Number.isNaN(r)) return Number.POSITIVE_INFINITY;
  const now = new Date();
  const retrieved = new Date(r);
  const years = now.getUTCFullYear() - retrieved.getUTCFullYear();
  const months = now.getUTCMonth() - retrieved.getUTCMonth();
  return Math.max(0, years * 12 + months);
}

if (!existsSync(root)) {
  console.log("lint:rule-source-staleness OK (no rulesets dir)");
  process.exit(0);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".gitkeep" || entry.name === "README.md") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && full.endsWith(".json")) yield full;
  }
}

const errors = [];

for await (const file of walk(root)) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch {
    // Spec 008's lint catches malformed JSON; skip here.
    continue;
  }
  if (parsed === null || typeof parsed !== "object") continue;
  const ref = parsed.ref;
  if (ref === null || typeof ref !== "object") continue;
  const provenance = ref.provenance;
  if (provenance === null || typeof provenance !== "object") continue;
  const sourceKind = provenance.sourceKind;
  const retrievedAt = provenance.retrievedAt;
  if (typeof sourceKind !== "string" || typeof retrievedAt !== "string") continue;
  if (!(sourceKind in thresholds)) continue;
  const threshold = thresholds[sourceKind];
  const age = ageInMonths(retrievedAt);
  if (age > threshold) {
    errors.push(
      `${relative(repoRoot, file)}: stale (age=${age}mo, threshold=${threshold}mo, sourceKind=${sourceKind})`,
    );
  }
}

if (errors.length > 0) {
  console.error("RULE SOURCE STALENESS WARNINGS:");
  for (const e of errors) console.error(`  ${e}`);
  console.error("");
  console.error("Rule content is older than the staleness threshold. Refresh the");
  console.error("rule (acquire + verify + re-register) or override the threshold");
  console.error("via TENANT_0_STALENESS_*_MONTHS env vars. See Spec 010 §11.");
  process.exit(1);
}

console.log("lint:rule-source-staleness OK");