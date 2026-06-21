// AC-10 (Spec 008): zero new Core primitives.
// The engine is built without modifying @daedalus/core. This test asserts
// that invariant by greping packages/core/src for forbidden additions
// (engine-related identifiers) and by comparing the file count against a
// pre-engine snapshot.
//
// "Forbidden" identifiers = anything from the engine's domain (workflow /
// instance / guard / engine-event names). If any appears in packages/core/src,
// the engine leaked into the Core and broke Spec 008 §11's binding rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [
  "WorkflowInstanceStarted",
  "WorkflowTransitionFired",
  "WorkflowInstanceCompleted",
  "WorkflowInstanceCompensated",
  "HumanApprovalRequired",
  "HumanApproved",
  "HumanRejected",
  "isEngineEvent",
  "ENGINE_EVENT_PREFIXES",
  "capturingEventStore",
  "EngineDeps",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

test("AC-10: @daedalus/core has no engine-related identifiers", () => {
  const coreFiles = walk(join(process.cwd(), "packages/core/src"));
  assert.ok(coreFiles.length > 0, "Core src tree must exist");
  const offenders: string[] = [];
  for (const file of coreFiles) {
    const content = readFileSync(file, "utf8");
    for (const ident of FORBIDDEN) {
      // A bare-word match for the identifier (not a substring of another word).
      const re = new RegExp(`\\b${ident}\\b`);
      if (re.test(content)) offenders.push(`${file}: ${ident}`);
    }
  }
  assert.deepEqual(offenders, [], `Forbidden identifiers found in @daedalus/core: ${offenders.join(", ")}`);
});

test("AC-10: @daedalus/core's public index exports have not grown", async () => {
  // Capture the public surface exported by @daedalus/core and assert it
  // contains none of the engine-specific identifiers.
  const mod = (await import("@daedalus/core")) as Record<string, unknown>;
  const exportedNames = new Set(Object.keys(mod));
  for (const ident of FORBIDDEN) {
    assert.equal(exportedNames.has(ident), false, `${ident} must not be exported from @daedalus/core`);
  }
});