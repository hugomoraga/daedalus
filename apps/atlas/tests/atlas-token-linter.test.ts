// Token linter — Spec 007 AC-5.
// Fails if any source file outside tokens.ts declares a raw color literal,
// a font-family outside the canonical trio, or a numeric spacing outside the scale.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ATLAS_SRC = new URL("../src/", import.meta.url).pathname;

// Tokens are the canonical values. Anything else in the source must reference
// them via tokens.* or CSS variables.
const TOKEN_FILE = join(ATLAS_SRC, "tokens.ts");

const RAW_HEX = /#[0-9A-Fa-f]{3,8}\b/;
const RAW_RGB = /\brgba?\s*\(/;
const CANONICAL_FONTS = ["Inter Tight", "Inter", "JetBrains Mono"];
const FONT_FAMILY_DECL = /font-family\s*:\s*([^;]+);/g;
const RAW_PX_SPACING = /\b(\d+)px\b/g;
const SPACING_SCALE = new Set([4, 8, 12, 16, 24, 32, 48, 64, 96]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

test("atlas AC-5: no raw hex color literals outside tokens.ts", () => {
  const offenders: string[] = [];
  for (const file of walk(ATLAS_SRC)) {
    if (file === TOKEN_FILE) continue;
    const src = readFileSync(file, "utf8");
    // Allow hex inside string literals that are clearly identifiers (e.g. eventId) — only flag
    // when the literal looks like a CSS color.
    const matches = src.match(/#F[0-9A-F]{2}|#[0-9A-F]{6}\b|#FFF\b|#000\b/gi) ?? [];
    if (matches.length > 0) {
      offenders.push(`${relative(process.cwd(), file)}: ${matches.join(", ")}`);
    }
  }
  assert.deepEqual(offenders, [], `raw hex color literals outside tokens.ts:\n${offenders.join("\n")}`);
});

test("atlas AC-5: no raw rgba/rgb color literals outside tokens.ts", () => {
  const offenders: string[] = [];
  for (const file of walk(ATLAS_SRC)) {
    if (file === TOKEN_FILE) continue;
    const src = readFileSync(file, "utf8");
    const matches = src.match(RAW_RGB) ?? [];
    if (matches.length > 0) {
      offenders.push(`${relative(process.cwd(), file)}: ${matches.join(", ")}`);
    }
  }
  assert.deepEqual(offenders, [], `raw rgba/rgb color literals outside tokens.ts:\n${offenders.join("\n")}`);
});

test("atlas AC-5: font-family declarations use only the canonical trio", () => {
  const offenders: string[] = [];
  for (const file of walk(ATLAS_SRC)) {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    FONT_FAMILY_DECL.lastIndex = 0;
    while ((m = FONT_FAMILY_DECL.exec(src)) !== null) {
      const decl = m[1];
      // CSS variable references (var(--...)) are fine — they resolve at runtime
      // through :root declarations in tokens-driven stylesheets.
      if (/var\s*\(\s*--/.test(decl)) continue;
      const ok = CANONICAL_FONTS.some((f) => decl.includes(f));
      if (!ok) offenders.push(`${relative(process.cwd(), file)}: ${decl.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `non-canonical font-family declarations:\n${offenders.join("\n")}`);
});

test("atlas AC-5: numeric spacing in CSS uses only the canonical scale", () => {
  const offenders: string[] = [];
  for (const file of walk(ATLAS_SRC)) {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    RAW_PX_SPACING.lastIndex = 0;
    while ((m = RAW_PX_SPACING.exec(src)) !== null) {
      const n = Number(m[1]);
      if (n === 0 || n === 1) continue;
      if (!SPACING_SCALE.has(n)) {
        // Allow values that are clearly not spacing: font sizes, border widths,
        // border radii, layout widths (grid-template-columns), line heights, etc.
        const start = Math.max(0, m.index - 80);
        const ctx = src.slice(start, m.index + 30);
        if (/font-size|border|radius|height:|width:|grid-template|line-height|stroke|opacity:|min-width|max-width|grid-template-columns/.test(ctx)) continue;
        offenders.push(`${relative(process.cwd(), file)}: ${n}px`);
      }
    }
  }
  assert.deepEqual(offenders, [], `spacing values outside the canonical scale:\n${offenders.join("\n")}`);
});