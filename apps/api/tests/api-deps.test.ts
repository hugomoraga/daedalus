// apps/api/tests/api-deps.test.ts
//
// Spec 016 §8 AC-8 ("Zero external runtime dependencies"): the
// API's package.json must declare `dependencies: {}` — no
// Express, no Fastify, no ORM, no SDK. Node 22 native HTTP +
// native JSON are the contract.
//
// This test fails the build if any package slips into
// `dependencies`. A separate test for `devDependencies` (test
// harness, lint, etc.) is intentionally NOT added — the rule
// is *runtime* deps. devDependencies are fine.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

test("AC-8 (zero runtime deps): @daedalus/api declares empty dependencies", () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  assert.ok(
    pkg.dependencies !== undefined,
    "package.json must declare a dependencies block (even if empty)",
  );
  assert.deepEqual(
    Object.keys(pkg.dependencies ?? {}),
    [],
    "AC-8: zero external runtime dependencies (Node 22 native HTTP/JSON only)",
  );
});
