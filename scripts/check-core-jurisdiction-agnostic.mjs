#!/usr/bin/env node
// Spec 008 Plan §6 — lint: @daedalus/core must remain jurisdiction-agnostic.
// Reads config/jurisdiction/keywords.txt and fails if any keyword (or
// any keyword's case-insensitive prefix match on multi-word phrases) is
// found inside packages/core/src/**.
//
// Wired into `npm test` via the `lint:core-jurisdiction-agnostic` script.
// Exits 0 on success, 1 on failure.

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const keywordsFile = join(repoRoot, "config", "jurisdiction", "keywords.txt");
const coreSrc = join(repoRoot, "packages", "core", "src");

if (!existsSync(keywordsFile)) {
  console.error(`keywords file not found: ${keywordsFile}`);
  process.exit(2);
}
if (!existsSync(coreSrc)) {
  console.error(`core src not found: ${coreSrc}`);
  process.exit(2);
}

const keywordsRaw = await readFile(keywordsFile, "utf8");
const keywords = keywordsRaw
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"));

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".mjs"))) yield full;
  }
}

const offenders = [];
for await (const file of walk(coreSrc)) {
  const content = await readFile(file, "utf8");
  for (const kw of keywords) {
    // Case-insensitive whole-word-or-multi-word phrase match.
    const re = new RegExp(
      `(^|[^A-Za-z0-9_])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9_]|$)`,
      "i",
    );
    if (re.test(content)) {
      offenders.push({ file: relative(repoRoot, file), kw });
    }
  }
}

if (offenders.length > 0) {
  console.error("JURISDICTION KEYWORDS FOUND IN @daedalus/core:");
  for (const o of offenders) {
    console.error(`  ${o.file}: "${o.kw}"`);
  }
  console.error("");
  console.error("The Core must remain jurisdiction-agnostic. Move the term to");
  console.error("the Tenant layer (config/tenants/ or config/rulesets/) or to");
  console.error("a Module. See Plan 008 §6 (Conformance).");
  process.exit(1);
}

console.log("lint:core-jurisdiction-agnostic OK");