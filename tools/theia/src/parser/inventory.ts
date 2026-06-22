// Theia (Spec 012) — code inventory parser (PR 4).
//
// `parseCodeInventory(rootPath)` lists top-level entries of three
// directories and returns them as `CodeEntry` rows:
//   - `apps/*`    → kind: "app"
//   - `packages/*` → kind: "package"
//   - `tests/*`   → kind: "test"  (only `*.test.ts` files at the top level)
//
// Hidden entries (dotfiles) and `node_modules/` are skipped. The
// inventory is **flat** — no recursion into subdirectories. PR 8
// (server + views) renders this as a clickable code-inventory
// section per Spec §4 / AC-6.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CodeEntry } from "../types.ts";

const ROOTS: ReadonlyArray<{ dir: string; kind: CodeEntry["kind"] }> = [
  { dir: "apps", kind: "app" },
  { dir: "packages", kind: "package" },
  { dir: "tests", kind: "test" },
];

export function parseCodeInventory(rootPath: string): CodeEntry[] {
  const entries: CodeEntry[] = [];
  for (const { dir, kind } of ROOTS) {
    const full = join(rootPath, dir);
    if (!existsSync(full)) continue;
    const names = readdirSync(full);
    names.sort();
    for (const name of names) {
      if (name.startsWith(".")) continue;
      if (name === "node_modules") continue;
      if (kind === "test" && !name.endsWith(".test.ts")) continue;
      entries.push({ name, kind, link: `${dir}/${name}` });
    }
  }
  return entries;
}