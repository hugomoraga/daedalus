// Theia (Spec 012) — public barrel.
//
// The parser is the core. Re-export it here so tests + future CLI
// import from a single entry point. Views, runners, and the server
// are added in later PRs; the barrel is curated as the surface grows.

export { parseRepo } from "./parser.ts";
export type {
  ProjectState,
  SpecCard,
  SpecStatus,
  AdrRow,
  AdrStatus,
  UseCaseRow,
  CodeEntry,
  Phase,
  DiffSummary,
  TestResult,
  BlockerEntry,
  BlockerView,
} from "./types.ts";
