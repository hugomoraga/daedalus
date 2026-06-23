// Theia (Spec 012) — typed shapes for the parser's output.
//
// The parser is a pure function: given a repo root, it returns a
// `ProjectState`. Everything downstream (runners, views, server) reads
// from this shape. PR 1 ships the skeleton with empty arrays; later PRs
// fill the parsing phases.
//
// ADR-007: Theia does NOT import from @daedalus/* (AC-15). The single
// allowed exception is `src/views/tokens.ts`, which re-exports Atlas
// tokens for visual cohesion — Atlas never depends on Theia.

export type SpecStatus =
  | "Draft"
  | "Ratified"
  | "Blocked"
  | "Superseded"
  | "Planning"
  | "Shipped"
  | "Unknown";

export type AdrStatus = "Proposed" | "Accepted" | "Superseded" | "Unknown";

// A parsed `**Status:**` line carries a free-text tail after the status
// word (e.g. "Ratified · Phase 2 · Module specification"). We surface
// the raw tail as `statusTail` so the UI can render badges without
// re-parsing.
export type SpecCard = {
  slug: string; // e.g. "004-tax-compliance-guard"
  title: string; // first H1 line, e.g. "Spec 004 — Tax & Compliance Guard"
  status: SpecStatus;
  statusTail: string; // raw text after `Status:`
  phase: number | null; // extracted from statusTail or "Phase N" reference
  version: string | null; // from `**Version:**`
  lastUpdated: string | null; // ISO date from `**Last updated:**`
  summaryPreview: string; // first paragraph of "## 1." or "## Summary"
  tasksDone: number;
  tasksTotal: number;
  planDone: number;
  planTotal: number;
  taskList: TaskItem[]; // enumerated tasks from tasks.md, grouped by section
  links: {
    spec: string; // path relative to repo root
    plan: string | null;
    tasks: string | null;
  };
  unknownReason: string | null; // populated when status === "Unknown"
  blockers: BlockerEntry[]; // populated when status === "Blocked"
  conventionIssues: string[]; // Spec 015 §6 AC-4 — drift signals; empty when clean
};

// One canonical-format task line from tasks.md. Section is the most
// recent `## Heading` line; empty when the file has no `##` headings.
export type TaskItem = {
  id: string; // e.g. "T-01", "T-66a", "OF-12"
  text: string; // the prose after the id, e.g. "Create tools/theia/..."
  done: boolean; // true when the checkbox is [x] or [X]
  section: string; // current ## heading, or "" if none
};

export type AdrRow = {
  number: number; // 1..N
  slug: string; // e.g. "defer-root-entity-selection"
  title: string; // first H1 line
  status: AdrStatus;
  date: string | null; // ISO date from `**Date:**`
  link: string; // path relative to repo root
};

export type UseCaseRow = {
  command: string; // e.g. "lead:create"
  link: string; // path to apps/cli/src/commands/*.ts
};

export type CodeEntry = {
  name: string; // e.g. "core", "tax-compliance-guard"
  kind: "app" | "package" | "test";
  link: string; // path relative to repo root
};

export type Phase = {
  number: number; // 0..5
  title: string; // e.g. "Phase 3 — Policy Engine"
  milestoneCount: number;
};

export type DiffSummary = {
  branch: string | null;
  commits: Array<{ sha: string; subject: string }>;
  filesChanged: number;
  insertions: number;
  deletions: number;
  entries: Array<{ path: string; insertions: number; deletions: number }>;
  available: boolean;
  reason: string | null; // when available === false
};

export type TestResult = {
  running: boolean;
  total: number | null;
  pass: number | null;
  fail: number | null;
  failingNames: string[];
  startedAt: string | null;
  completedAt: string | null;
  reason: string | null; // when running === false and total === null
};

export type BlockerEntry = {
  // An unblocker for a BLOCKED spec: another spec or ADR that, once
  // ratified, removes the block.
  unblockerSlug: string;
  unblockerKind: "spec" | "adr";
};

// Aggregated per-spec blocker view (used by the "Blocked by" + "Next
// unlocks" sections). Pre-computed by the parser for efficiency.
export type BlockerView = {
  blockedSlug: string;
  unblockers: BlockerEntry[];
};

// Top-level aggregate. The parser returns this; runners + views
// consume it; the server serializes it.
export type ProjectState = {
  rootPath: string;
  computedAt: string; // ISO timestamp; used for cache busting + AC-14
  specs: SpecCard[];
  adrs: AdrRow[];
  useCases: UseCaseRow[];
  codeInventory: CodeEntry[];
  phases: Phase[];
  activePhase: number;
  blockers: BlockerView[];
  nextUnlocks: Array<{ slug: string; unlocksCount: number }>;
  diff: DiffSummary;
  tests: TestResult;
  backlog: BacklogItem[]; // Spec 012 follow-up — `docs/backlog.md` parsed
};

// One entry from `docs/backlog.md` (UX-004). The parser contract at
// the top of the file defines the regexes; this type is the result.
export type BacklogItem = {
  id: string; // e.g. "BUG-001", "UX-004" — captured from `## ID — Title`
  title: string; // captured from the same header
  status: string; // raw value after `**Status:**`. Allowed set: open | in-progress | wontfix | done
  kind: string; // raw value after `**Kind:**`. Allowed set: bug | follow-up | churn | deprecation
  source: string; // raw value after `**Source:**` (required)
  affects: string | null; // raw value after `**Affects:**` (optional)
  body: string; // prose after the structured block, until the next `##` heading
};
