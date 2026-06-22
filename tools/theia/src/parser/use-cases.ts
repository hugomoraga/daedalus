// Theia (Spec 012) — CLI use-case parser (PR 4).
//
// `parseUseCases(rootPath)` extracts the CLI surface from
// `apps/cli/src/commands/*.ts`. Each command file exports a
// `handlers: Array<[string, CommandHandler]>` with the first tuple
// element being the command name (e.g. `"lead:create"`).
//
// The Plan §2 originally proposed a regex over `apps/cli/src/index.ts`
// for `case "...":` patterns. After PR #34 (CLI split into per-command
// files), the codebase no longer uses the `case` pattern — the live
// repo's CLI registers commands via the `handlers` array. This
// parser reflects the current shape. It also tolerates the legacy
// `case "...":` pattern by matching either `[ "name",` (per-command
// files) or `case "name":` (inline switch) inside the index.
//
// Returns the deduped + sorted list of commands. Sort order is
// alphabetical per AC-7.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { UseCaseRow } from "../types.ts";

const CLI_COMMANDS_DIR = "apps/cli/src/commands";
const CLI_INDEX = "apps/cli/src/index.ts";

// Matches `[ "name",` (per-command-files) or `case "name":` (legacy inline).
// Commands are `<group>:<action>` — a single colon, not double.
const COMMAND_RE = /(?:\[\s*|case\s+)["']([a-z][a-z0-9-]*:[a-z0-9-]+)["']/g;

export function parseUseCases(rootPath: string): UseCaseRow[] {
  const commandsDir = join(rootPath, CLI_COMMANDS_DIR);
  const indexFile = join(rootPath, CLI_INDEX);
  const found = new Map<string, string>();
  if (existsSync(commandsDir)) {
    for (const name of readdirSync(commandsDir)) {
      if (!name.endsWith(".ts")) continue;
      const filePath = join(commandsDir, name);
      const content = readFileSync(filePath, "utf8");
      for (const match of content.matchAll(COMMAND_RE)) {
        const cmd = match[1];
        if (cmd === undefined) continue;
        found.set(cmd, `${CLI_COMMANDS_DIR}/${name}`);
      }
    }
  }
  if (existsSync(indexFile)) {
    const content = readFileSync(indexFile, "utf8");
    for (const match of content.matchAll(COMMAND_RE)) {
      const cmd = match[1];
      if (cmd === undefined) continue;
      if (!found.has(cmd)) {
        found.set(cmd, CLI_INDEX);
      }
    }
  }
  const rows: UseCaseRow[] = [];
  for (const [command, link] of found) {
    rows.push({ command, link });
  }
  // AC-7: sorted alphabetically.
  rows.sort((a, b) => a.command.localeCompare(b.command));
  return rows;
}