// Theia (Spec 012 follow-up, UX-004) — backlog parser.
//
// `parseBacklog(rootPath)` reads `docs/backlog.md` and returns one
// `BacklogItem` per `## ID — Title` header. The parser contract is
// documented in the file's own header (under "Parser contract");
// this module is the implementation.
//
// Field regexes (mirroring the contract):
//   - `^## ([A-Z]+-\d+) — (.+)$` → id, title
//   - `^\*\*Status:\*\* (.+)$`  → status
//   - `^\*\*Kind:\*\* (.+)$`    → kind
//   - `^\*\*Source:\*\* (.+)$`  → source
//   - `^\*\*Affects:\*\* (.+)$` → affects (optional)
//
// Prose after the structured field block (and before the next
// `## ...` header or EOF) is captured as `body` for the view.
//
// Skipped sections (no `ID-NNN` prefix): the parser contract
// itself, the "When to add an item" guidance, and any other
// `## ...` heading that doesn't match the item shape. This keeps
// the parser strictly to data rows, even if a human adds a
// non-item heading later.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BacklogItem } from "../types.ts";

const BACKLOG_FILE = "docs/backlog.md";
const HEADER_RE = /^##\s+([A-Z]+-\d+)\s+—\s+(.+?)\s*$/;
const STATUS_RE = /^\*\*Status:\*\*\s+(.+?)\s*$/;
const KIND_RE = /^\*\*Kind:\*\*\s+(.+?)\s*$/;
const SOURCE_RE = /^\*\*Source:\*\*\s+(.+?)\s*$/;
const AFFECTS_RE = /^\*\*Affects:\*\*\s+(.+?)\s*$/;
const NEXT_HEADER_RE = /^##\s+/;

export function parseBacklog(rootPath: string): BacklogItem[] {
  const file = join(rootPath, BACKLOG_FILE);
  if (!existsSync(file)) return [];
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  const items: BacklogItem[] = [];
  let current: BacklogItem | null = null;
  let structuredDone = false;
  let bodyBuf: string[] = [];

  const flush = (): void => {
    if (current === null) return;
    current.body = bodyBuf.join("\n").trim();
    items.push(current);
    current = null;
    structuredDone = false;
    bodyBuf = [];
  };

  for (const line of lines) {
    const header = HEADER_RE.exec(line);
    if (header !== null) {
      // Start of a new item: flush the previous one (if any).
      flush();
      current = {
        id: header[1] ?? "",
        title: header[2] ?? "",
        status: "",
        kind: "",
        source: "",
        affects: null,
        body: "",
      };
      continue;
    }
    if (current === null) continue;

    // Inside an item. First, capture the four (five with Affects) field
    // lines; once we've seen all four required ones, switch to body
    // capture. Any `## ...` line ends the current item.
    if (NEXT_HEADER_RE.test(line)) {
      flush();
      continue;
    }

    if (!structuredDone) {
      const s = STATUS_RE.exec(line);
      if (s !== null) { current.status = (s[1] ?? "").trim(); continue; }
      const k = KIND_RE.exec(line);
      if (k !== null) { current.kind = (k[1] ?? "").trim(); continue; }
      const src = SOURCE_RE.exec(line);
      if (src !== null) { current.source = (src[1] ?? "").trim(); continue; }
      const a = AFFECTS_RE.exec(line);
      if (a !== null) { current.affects = (a[1] ?? "").trim(); continue; }
      // The first non-field, non-blank line after a header is the end
      // of the structured block. From here, capture prose as body.
      // Blank lines in the middle of the structured block are also
      // allowed; skip them while we're still collecting fields.
      if (line.trim().length === 0) continue;
      // Heuristic: once we've seen all three required fields and the
      // current line is prose (no `**Field:**` prefix), we transition.
      if (current.status !== "" && current.kind !== "" && current.source !== "") {
        structuredDone = true;
        bodyBuf.push(line);
      }
      continue;
    }

    // Body capture: keep the line as-is.
    bodyBuf.push(line);
  }
  flush();

  // Sort by id ascending for deterministic rendering. IDs are
  // `<KIND-PREFIX>-NNN`; sorting by string is fine because the
  // numeric portion is zero-padded to 3 digits per the contract.
  items.sort((a, b) => a.id.localeCompare(b.id));
  return items;
}
