// Theia (Spec 012) — ADR parser (PR 3).
//
// `parseAdrs(rootPath)` walks `governance/decisions/ADR-NNN-*.md`
// (sorted by number ascending — matches AC-5: "Sorted by number
// ascending.") and extracts per-ADR structured fields.
//
// Each ADR's `**Status:**` line carries one of {Proposed, Accepted,
// Superseded} as the first word. The parser follows the same
// first-word convention as parseSpecs. Unknown statuses fall back to
// `status: "Unknown"` (defensive — no ADR in the repo currently uses
// an unknown status, but the parser is robust against drift).
//
// Date extraction matches `**Date:** YYYY-MM-DD` (ISO date only — the
// repo's ADRs use ISO dates; if a future ADR uses full ISO timestamps,
// the first 10 chars still match).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AdrRow, AdrStatus } from "../types.ts";

const DECISIONS_DIR = "governance/decisions";
const ADR_FILENAME_RE = /^ADR-(\d{3})-(.+)\.md$/;
const TITLE_RE = /^#\s+(.+?)\s*$/m;
const STATUS_RE = /^\*\*Status:\*\*\s+(.+?)\s*$/m;
const DATE_RE = /^\*\*Date:\*\*\s+(.+?)\s*$/m;

const KNOWN_STATUSES: ReadonlySet<AdrStatus> = new Set<AdrStatus>([
  "Proposed",
  "Accepted",
  "Superseded",
  "Unknown",
]);

export function parseAdrs(rootPath: string): AdrRow[] {
  const dir = join(rootPath, DECISIONS_DIR);
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const rows: AdrRow[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const m = ADR_FILENAME_RE.exec(entry.name);
    if (m === null) continue;
    const filePath = join(dir, entry.name);
    rows.push(parseOne(filePath, entry.name, Number(m[1]), m[2] ?? ""));
  }
  // AC-5: sorted by number ascending.
  rows.sort((a, b) => a.number - b.number);
  return rows;
}

function parseOne(filePath: string, filename: string, number: number, slug: string): AdrRow {
  const content = readFileSync(filePath, "utf8");
  const titleMatch = content.match(TITLE_RE);
  const title = titleMatch !== null && titleMatch[1] !== undefined ? titleMatch[1].trim() : filename;

  const statusMatch = content.match(STATUS_RE);
  let status: AdrStatus = "Unknown";
  if (statusMatch !== null && statusMatch[1] !== undefined) {
    const firstWord = statusMatch[1].split(/\s+/, 1)[0] ?? "";
    if (KNOWN_STATUSES.has(firstWord as AdrStatus)) {
      status = firstWord as AdrStatus;
    }
  }

  const dateMatch = content.match(DATE_RE);
  const date =
    dateMatch !== null && dateMatch[1] !== undefined ? dateMatch[1].trim().slice(0, 10) : null;

  return {
    number,
    slug,
    title,
    status,
    date,
    link: `${DECISIONS_DIR}/${filename}`,
  };
}