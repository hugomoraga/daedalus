// Theia (Spec 012) — roadmap phases parser (PR 3).
//
// `parsePhases(rootPath)` reads `docs/roadmap.md` and extracts one
// `Phase` per `## Phase N — Title` header. Milestone count is a rough
// heuristic: list-item bullets (`- **...**`) between the phase header
// and the next `##` heading, or `- ` plain items, excluding nested
// sub-sections.
//
// Roadmap headers use the form `## Phase N — Title` (with em-dash),
// plus a `Phase 1+` follow-on variant. The parser extracts the FIRST
// integer after "Phase" — so "Phase 0", "Phase 5", and "Phase 1+
// follow-on" all parse correctly. The follow-on variant gets
// `number = 1` (matches the integer).
//
// Phases are sorted by `number` ascending so the timeline renders
// deterministically.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Phase } from "../types.ts";

const ROADMAP_FILE = "docs/roadmap.md";
const PHASE_HEADER_RE = /^##\s+Phase\s+(\d+)(\+)?\s*[—\-]\s*(.+?)\s*$/;
const NEXT_HEADER_RE = /^##\s+/;
const MILESTONE_RE = /^[\s]*[-*]\s+(?:\*\*[^*]+\*\*|\S)/;

export function parsePhases(rootPath: string): Phase[] {
  const file = join(rootPath, ROADMAP_FILE);
  if (!existsSync(file)) return [];
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const phases: Phase[] = [];
  let current: Phase | null = null;
  for (const line of lines) {
    const headerMatch = PHASE_HEADER_RE.exec(line);
    if (headerMatch !== null) {
      // Push the previous phase (if any) before starting the next.
      if (current !== null) {
        phases.push(current);
      }
      current = {
        number: Number(headerMatch[1]),
        title: headerMatch[3] ?? "",
        milestoneCount: 0,
      };
      continue;
    }
    if (current === null) continue;
    // End of current phase's section.
    if (NEXT_HEADER_RE.test(line)) {
      phases.push(current);
      current = null;
      continue;
    }
    // Count milestones inside the current phase.
    if (MILESTONE_RE.test(line)) {
      current.milestoneCount += 1;
    }
  }
  if (current !== null) phases.push(current);
  // Defensive: if multiple phases share the same number (e.g. "Phase
  // 1" + "Phase 1+ follow-on"), keep the FIRST one and skip the rest.
  const seen = new Set<number>();
  const dedup: Phase[] = [];
  for (const p of phases) {
    if (seen.has(p.number)) continue;
    seen.add(p.number);
    dedup.push(p);
  }
  dedup.sort((a, b) => a.number - b.number);
  return dedup;
}