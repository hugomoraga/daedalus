// Tax & Compliance Guard — CLI command wiring test.
// Verifies the 3 obligations:* commands are registered in the CLI handler
// map. The handlers themselves are thin shells over the Module's use
// cases (Plan §6); the use cases have their own 9-AC test in
// tax-compliance-guard.test.ts. We do NOT spawn the CLI as a
// subprocess — there's no precedent in the codebase and the handler
// map is the only surface that benefits from an explicit check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handlers } from "../apps/cli/src/commands/obligations.ts";

test("CLI registers the 3 obligations:* commands", () => {
  const names = handlers.map(([name]) => name);
  assert.deepEqual(names, [
    "obligations:list",
    "obligations:ack",
    "obligations:sweep",
  ]);
});
