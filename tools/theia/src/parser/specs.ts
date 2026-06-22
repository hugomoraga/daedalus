// Theia (Spec 012) — specs parser (PR 2).
//
// `parseSpecs(rootPath)` walks `specs/NNN-*/*.md` (sorted by NNN) and
// extracts per-spec structured fields. Returns a `SpecCard[]` sorted by
// slug ascending.
//
// Each spec's `**Status:**` line is the contract. The parser:
//   - reads the FIRST WORD as `status` (Ratified / Draft / Blocked /
//     Superseded / Unknown),
//   - reads the rest of the line as `statusTail`,
//   - extracts the FIRST `Phase N` occurrence from the tail as `phase`
//     (null if absent),
//   - leaves `unknownReason` populated when the Status line is missing
//     or unparseable (per AC-3).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SpecCard, SpecStatus } from "../types.ts";
import { parseSpecCompletion } from "./completion.ts";

const SPECS_DIR = "specs";
const STATUS_RE = /^\*\*Status:\*\*\s+(.+?)\s*$/m;
const VERSION_RE = /^\*\*Version:\*\*\s+(.+?)\s*$/m;
const LAST_UPDATED_RE = /^\*\*Last updated:\*\*\s+(.+?)\s*$/m;
const PHASE_RE = /Phase\s+(\d+)/;
// A spec slug starts with 3 digits, dash, then any chars (no slash).
const SLUG_RE = /^(\d{3})-(.+)$/;

const KNOWN_STATUSES: ReadonlySet<SpecStatus> = new Set<SpecStatus>([
  "Draft",
  "Ratified",
  "Blocked",
  "Superseded",
  "Planning",
  "Shipped",
  "Unknown",
]);

export function parseSpecs(rootPath: string): SpecCard[] {
  const specsDir = join(rootPath, SPECS_DIR);
  if (!existsSync(specsDir)) return [];
  const entries = readdirSync(specsDir, { withFileTypes: true });
  const slugs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    if (!SLUG_RE.test(slug)) continue;
    // Only consider dirs that have a spec.md (others may be evidence/).
    const specPath = join(specsDir, slug, "spec.md");
    if (!existsSync(specPath)) continue;
    slugs.push(slug);
  }
  slugs.sort();
  const cards: SpecCard[] = [];
  for (const slug of slugs) {
    cards.push(parseOne(rootPath, slug));
  }
  return cards;
}

function parseOne(rootPath: string, slug: string): SpecCard {
  const specPath = join(rootPath, SPECS_DIR, slug, "spec.md");
  const tasksPath = join(rootPath, SPECS_DIR, slug, "tasks.md");
  const planPath = join(rootPath, SPECS_DIR, slug, "plan.md");
  const content = readFileSync(specPath, "utf8");

  const title = extractTitle(content) ?? slug;
  const statusLine = content.match(STATUS_RE);
  let status: SpecStatus = "Unknown";
  let statusTail = "";
  let unknownReason: string | null = null;
  if (statusLine === null || statusLine[1] === undefined) {
    unknownReason = "Status line missing";
  } else {
    statusTail = statusLine[1];
    const firstWord = statusTail.split(/\s+/, 1)[0] ?? "";
    if (KNOWN_STATUSES.has(firstWord as SpecStatus)) {
      status = firstWord as SpecStatus;
    } else {
      unknownReason = `unrecognized status word: "${firstWord}"`;
    }
  }
  // AC-3: any spec with an unknown status is rendered with a warning
  // and the unknownReason is exposed for the UI.
  if (status === "Unknown" && unknownReason === null) {
    unknownReason = "Status line missing or unparseable";
  }

  const phaseMatch = statusTail.match(PHASE_RE);
  const phase = phaseMatch !== null && phaseMatch[1] !== undefined ? Number(phaseMatch[1]) : null;

  const versionMatch = content.match(VERSION_RE);
  const version = versionMatch !== null && versionMatch[1] !== undefined ? versionMatch[1].trim() : null;

  const lastUpdatedMatch = content.match(LAST_UPDATED_RE);
  const lastUpdated =
    lastUpdatedMatch !== null && lastUpdatedMatch[1] !== undefined ? lastUpdatedMatch[1].trim() : null;

  const summaryPreview = extractSummary(content);

  // Task completion is computed here so callers of `parseSpecs` alone
  // get the same shape callers of `parseRepo` get. parseRepo no
  // longer needs to fill these — it just delegates to parseSpecs.
  const completion = parseSpecCompletion(rootPath, slug);

  const card: SpecCard = {
    slug,
    title,
    status,
    statusTail,
    phase,
    version,
    lastUpdated,
    summaryPreview,
    tasksDone: completion.tasks.done,
    tasksTotal: completion.tasks.total,
    planDone: completion.plan.done,
    planTotal: completion.plan.total,
    links: {
      spec: `${SPECS_DIR}/${slug}/spec.md`,
      plan: existsSync(planPath) ? `${SPECS_DIR}/${slug}/plan.md` : null,
      tasks: existsSync(tasksPath) ? `${SPECS_DIR}/${slug}/tasks.md` : null,
    },
    unknownReason,
    blockers: [],
    conventionIssues: computeConventionIssues({
      status,
      unknownReason,
      tasksPath,
      tasksTotal: completion.tasks.total,
    }),
  };
  return card;
}

// Spec 015 §6 AC-4 — surface drift signals so the overview widget can
// render them. Pure function: given the inputs the parser already has,
// returns a list of human-readable issues (empty when the spec is in
// canonical form). Used by the "Specs needing attention" widget.
function computeConventionIssues(args: {
  status: SpecStatus;
  unknownReason: string | null;
  tasksPath: string;
  tasksTotal: number;
}): string[] {
  const issues: string[] = [];
  if (!existsSync(args.tasksPath)) {
    issues.push("tasks.md missing");
  } else if (args.tasksTotal === 0 && args.status !== "Draft") {
    issues.push("tasks.md has 0 checkboxes");
  }
  if (args.status === "Unknown") {
    issues.push(`Unknown status: ${args.unknownReason ?? "unparsed"}`);
  }
  return issues;
}

// First H1 line: `# Spec NNN — Title` or `# Spec NNN: Title`.
function extractTitle(content: string): string | null {
  const m = content.match(/^#\s+(.+?)\s*$/m);
  return m !== null && m[1] !== undefined ? m[1].trim() : null;
}

// First non-empty paragraph after a `## 1. Summary` / `## Summary` /
// `## 1. Why ...` heading. Falls back to the first non-empty paragraph
// after the title block.
function extractSummary(content: string): string {
  const lines = content.split("\n");
  let inSummary = false;
  const collected: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inSummary) {
      if (/^##\s+(1\.\s+Summary|Summary)\b/.test(trimmed)) {
        inSummary = true;
      }
      continue;
    }
    if (trimmed.length === 0) {
      if (collected.length > 0) break;
      continue;
    }
    if (/^##\s+/.test(trimmed)) break; // next section
    if (trimmed.startsWith(">")) continue; // blockquote (preamble)
    if (trimmed.startsWith("**")) continue; // bold metadata (preamble)
    collected.push(trimmed);
    if (collected.join(" ").length > 240) break;
  }
  const joined = collected.join(" ").trim();
  return joined.length > 0 ? joined.slice(0, 240) + (joined.length > 240 ? "…" : "") : "";
}

// Compute active phase = highest phase with a Ratified spec; 0 if none.
export function computeActivePhase(specs: readonly SpecCard[]): number {
  let max = 0;
  for (const card of specs) {
    if (card.status === "Ratified" && card.phase !== null && card.phase > max) {
      max = card.phase;
    }
  }
  return max;
}
