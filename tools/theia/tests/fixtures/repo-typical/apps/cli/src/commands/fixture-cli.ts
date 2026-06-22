// Fixture CLI command file for Theia parser tests (PR 4).
//
// Exports a `handlers` array with 5 commands, mirroring the
// per-command-files pattern from apps/cli/src/commands/*.ts (post
// PR #34).

export const handlers: Array<[string, unknown]> = [
  ["alpha:create", null],
  ["beta:list", null],
  ["gamma:delete", null],
  ["delta:status", null],
  ["epsilon:run", null],
];