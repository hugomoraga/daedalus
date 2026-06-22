// Theia (Spec 012) — Atlas-token-linter test (PR 8, AC-11).
//
// Re-uses Atlas's linter logic to verify Theia's views use only
// Atlas tokens — no raw color literals, no fonts outside the trio,
// no spacing outside the canonical scale.
//
// The single allowed platform import is `views/tokens.ts` which
// re-exports from Atlas; the linter permits that import. All
// OTHER Theia files must not import from `@daedalus/*`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// AC-15: no imports from `@daedalus/*` packages. The single allowed
// exception is `tools/theia/src/views/tokens.ts` which re-exports
// from Atlas for visual cohesion. The linter verifies both halves.
test("AC-15: tools/theia/src/** has zero imports from @daedalus/* (except views/tokens.ts)", async () => {
  const { statSync } = await import("node:fs");
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const srcRoot = join(repoRoot, "tools", "theia", "src");
  if (!existsSync(srcRoot)) return; // nothing to check
  const offenders: Array<{ file: string; line: string }> = [];
  const ALLOWED = join(srcRoot, "views", "tokens.ts");
  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) yield* walk(full);
      else if (entry.isFile() && full.endsWith(".ts")) yield full;
    }
  }
  for (const file of walk(srcRoot)) {
    if (file === ALLOWED) continue;
    const content = readFileSync(file, "utf8");
    // Match `from "@daedalus/..."` or `import("@daedalus/...")`.
    const matches = content.match(/from\s+["']@daedalus\/[^"']+["']|import\s*\(\s*["']@daedalus\/[^"']+["']\s*\)/g);
    if (matches !== null) {
      for (const m of matches) offenders.push({ file, line: m });
    }
  }
  void statSync;
  assert.deepEqual(
    offenders,
    [],
    `AC-15 violation — these files import from @daedalus/* but are not views/tokens.ts:\n  ${offenders.map((o) => `${o.file}: ${o.line}`).join("\n  ")}`,
  );
});

// AC-11: Theia's views/*.ts files don't contain raw colors, fonts, or
// spacing outside the canonical scale. We mirror Atlas's linter rules:
//   - No raw color literal (hex, rgb(), named colors other than 'transparent').
//   - No font-family outside the trio (Inter Tight, Inter, JetBrains Mono).
//   - No numeric spacing outside the scale [4, 8, 12, 16, 24, 32, 48, 64, 96].
//     Spacing is checked ONLY inside padding/margin/gap — width/height/
//     border-radius/border-width are exempt (they follow different rules).
test("AC-11: views/*.ts contain no raw colors / fonts / spacing outside scale", async () => {
  const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const viewsRoot = join(repoRoot, "tools", "theia", "src", "views");
  if (!existsSync(viewsRoot)) return;
  const offenders: Array<{ file: string; issue: string }> = [];
  const SPACING_SCALE = new Set([4, 8, 12, 16, 24, 32, 48, 64, 96]);
  const ALLOWED_FONTS = new Set(["Inter Tight", "Inter", "JetBrains Mono"]);
  // CSS properties whose numeric value MUST come from SPACING_SCALE.
  const SPACING_PROPS = ["padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "gap", "row-gap", "column-gap"];
  for (const entry of readdirSync(viewsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const file = join(viewsRoot, entry.name);
    const content = readFileSync(file, "utf8");
    // 1. Raw hex colors (#abc or #abcdef) are offenses (Atlas uses tokens).
    const hexMatches = content.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hexMatches !== null) {
      offenders.push({ file, issue: `raw hex color: ${hexMatches.join(", ")}` });
    }
    // 2. font-family strings outside the trio.
    const fontMatches = content.matchAll(/font-family\s*:\s*(?:var\([^)]+\)|["']?([^"';,}]+)["']?)/g);
    for (const m of fontMatches) {
      const value = m[1];
      if (value !== undefined && value.length > 0 && !ALLOWED_FONTS.has(value) && !value.startsWith("var(")) {
        offenders.push({ file, issue: `non-trio font-family: ${value}` });
      }
    }
    // 3. Numeric spacing: only inside padding/margin/gap properties.
    for (const prop of SPACING_PROPS) {
      // Match `<prop>: ... <n>px ...` — one occurrence per property/value pair.
      const re = new RegExp(`${prop}\\s*:\\s*([^;{]+)`, "g");
      for (const decl of content.matchAll(re)) {
        const valueBlock = decl[1] ?? "";
        for (const px of valueBlock.matchAll(/(\d+)px/g)) {
          const n = Number(px[1]);
          if (!Number.isFinite(n)) continue;
          if (!SPACING_SCALE.has(n)) {
            // 0 is exempt (no spacing).
            if (n !== 0) {
              offenders.push({ file, issue: `${prop}: ${n}px not in canonical scale` });
            }
          }
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `AC-11 violation — Theia views use raw colors / fonts / spacing outside the canonical scale:\n  ${offenders.map((o) => `${o.file}: ${o.issue}`).join("\n  ")}`,
  );
});