// Theia (Spec 012) — public barrel.
//
// The parser is the core. Re-export it here so tests + future CLI
// import from a single entry point. Views, runners, and the server
// are added in later PRs; the barrel is curated as the surface grows.

export { parseRepo } from "./parser.ts";
export { parseSpecs, computeActivePhase } from "./parser/specs.ts";
export {
  parseSpecCompletion,
  countCheckboxes,
  mergeCompletion,
  type CompletionCounts,
  type SpecCompletion,
} from "./parser/completion.ts";
export { parseAdrs } from "./parser/adrs.ts";
export { parsePhases } from "./parser/phases.ts";
export { parseCodeInventory } from "./parser/inventory.ts";
export { parseUseCases } from "./parser/use-cases.ts";
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