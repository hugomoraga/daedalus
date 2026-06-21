// AC-2 (Spec 008): idempotency.
// Re-processing the same event must not re-fire a transition.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps } from "./helpers.ts";
import { WorkflowTransitionFired } from "@daedalus/workflow-engine";

test("AC-2: re-processing the same event does not duplicate transitions", async () => {
  const e = makeEngineDeps();
  // Seed LeadQualified (the trigger for draft -> qualified).
  await e.append({
    eventId: "evt-1",
    type: "LeadQualified",
    tenantId: e.tenantId,
    occurredAt: "2026-06-21T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: { leadId: "lead-1" },
  });
  await e.runFor(150);
  const after1 = await e.readStream(e.tenantId);
  const fired1 = after1.filter((x) => x.type === WorkflowTransitionFired).length;
  assert.equal(fired1, 1);

  // Wipe the engine cursor to simulate an engine restart that re-reads the
  // stream from the beginning. The transition log on the instance (firedTransitionIds)
  // must still prevent a re-fire.
  await e.resetCursor();
  await e.runFor(150);
  const after2 = await e.readStream(e.tenantId);
  const fired2 = after2.filter((x) => x.type === WorkflowTransitionFired).length;
  assert.equal(fired2, 1, "no duplicate transition fired on replay");
});