// apps/cli/tests/registry.test.ts
//
// Spec 016 (Platform API) §13 activation gate #4 baseline: the CLI
// use case registry is enumerated with a parity test in place, so
// AC-12 ("given the CLI's case set … assert the parity for each")
// has a known shape.
//
// This test asserts the canonical invariants of the registry:
//
//   - non-empty
//   - sorted (canonical order matches Theia's parseUseCases sort)
//   - no duplicates (registry entries are unique)
//   - each name follows the `<group>:<action>` format (lowercase,
//     dashes allowed, single colon — matches Spec 016 §11 Q3 shape)
//   - the names exposed by the registry are exactly the keys of
//     CLI_HANDLERS (no drift between the two views)
//   - several stable anchor commands are present (regression
//     baseline: if a future refactor drops a core command, fail)
//
// Future PRs in the Spec 016 series will add a CLI ↔ API parity
// test (AC-1, AC-12) that imports CLI_COMMAND_NAMES and asserts
// the API exposes the same set under
// `POST /v1/tenants/:tenantId/commands/<group>/<action>`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLI_COMMAND_NAMES,
  CLI_HANDLERS,
} from "../src/commands/registry.ts";

test("CLI_COMMAND_NAMES is non-empty (registry has at least one command)", () => {
  assert.ok(
    CLI_COMMAND_NAMES.length > 0,
    "registry should not be empty — at least one CLI command must be wired in",
  );
});

test("CLI_COMMAND_NAMES is sorted (canonical order, mirrors Theia's parseUseCases sort)", () => {
  for (let i = 1; i < CLI_COMMAND_NAMES.length; i++) {
    const prev = CLI_COMMAND_NAMES[i - 1];
    const curr = CLI_COMMAND_NAMES[i];
    assert.ok(
      prev !== undefined && curr !== undefined && prev.localeCompare(curr) <= 0,
      `${prev} should be <= ${curr} (registry must be sorted)`,
    );
  }
});

test("CLI_COMMAND_NAMES has no duplicates (registry keys are unique)", () => {
  assert.equal(new Set(CLI_COMMAND_NAMES).size, CLI_COMMAND_NAMES.length);
});

test("CLI_COMMAND_NAMES use lowercase + dashes only (canonical char shape)", () => {
  // Accept both `<group>:<action>` (canonical) and a single token (legacy;
  // currently `events`). The colon-form is enforced separately below.
  const re = /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/;
  for (const name of CLI_COMMAND_NAMES) {
    assert.match(
      name,
      re,
      `command name "${name}" must match ${re} (lowercase, dashes OK, single colon OK)`,
    );
  }
});

test("CLI_COMMAND_NAMES with a colon follow the full <group>:<action> format (Spec 016 §11 Q3)", () => {
  const colonRe = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
  for (const name of CLI_COMMAND_NAMES) {
    if (name.includes(":")) {
      assert.match(
        name,
        colonRe,
        `colon-bearing command "${name}" must match ${colonRe} — Spec 016 §11 Q3 + §8 AC-12 (the API transforms ':' → '/')`,
      );
    }
  }
});

test("CLI_HANDLERS.keys() === CLI_COMMAND_NAMES (no drift between the two views)", () => {
  const fromMap = [...CLI_HANDLERS.keys()].sort();
  assert.deepEqual(fromMap, [...CLI_COMMAND_NAMES]);
});

test("registry includes the anchor commands (regression baseline)", () => {
  const anchors = [
    "lead:create",
    "lead:qualify",
    "proposal:approve",
    "obligations:list",
  ];
  for (const expected of anchors) {
    assert.ok(
      CLI_COMMAND_NAMES.includes(expected),
      `${expected} should be in the registry — Spec 016 §13 gate #4 baseline`,
    );
  }
});
