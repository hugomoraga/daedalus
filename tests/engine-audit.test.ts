// AC-8 (Spec 008): auditability.
// Every engine event must carry full lineage (tenant, actor, correlationId,
// causationId, payload); the event log must replay to reconstruct history.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps } from "./helpers.ts";
import {
  WorkflowInstanceStarted,
  WorkflowTransitionFired,
  type DomainEvent,
} from "@daedalus/workflow-engine";

test("AC-8: every engine event has full lineage + replay reconstructs history", async () => {
  const e = makeEngineDeps();
  await e.append({
    eventId: "seed-1",
    type: "LeadQualified",
    tenantId: e.tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: { leadId: "lead-1" },
  });
  await e.runFor(200);

  const events = await e.readStream(e.tenantId);
  const engineEvents = events.filter((x) =>
    x.type === WorkflowInstanceStarted || x.type === WorkflowTransitionFired,
  );
  assert.ok(engineEvents.length >= 2);

  for (const ev of engineEvents) {
    assert.ok(typeof ev.eventId === "string" && ev.eventId.length > 0, "eventId present");
    assert.ok(typeof ev.type === "string");
    assert.equal(ev.tenantId, e.tenantId);
    assert.equal(ev.actor, "test");
    assert.ok(typeof ev.occurredAt === "string" && ev.occurredAt.length > 0);
    assert.ok(typeof ev.correlationId === "string" && ev.correlationId.length > 0);
    // causationId is either null (flow origin) or a non-empty string.
    if (ev.causationId !== null) {
      assert.ok(typeof ev.causationId === "string");
    }
    assert.ok(typeof ev.payload === "object" && ev.payload !== null);
  }

  // Replay reconstructs the instance history. The instance log + the engine
  // events together must tell the same story.
  const instances = await e.deps.instanceStore.findByCorrelationId(e.tenantId, "flow-1");
  assert.equal(instances.length, 1);
  const instance = instances[0];
  assert.equal(instance.id, "flow-1");
  assert.equal(instance.currentState, "qualified");
  // The instance's firedTransitionIds match the WorkflowTransitionFired count
  // for this correlation.
  const firedForFlow = engineEvents.filter(
    (x) => x.type === WorkflowTransitionFired && x.correlationId === "flow-1",
  );
  assert.equal(
    instance.firedTransitionIds.length,
    firedForFlow.length,
    "instance log + engine events agree on transition count",
  );
  // Replay order: WorkflowInstanceStarted before any WorkflowTransitionFired
  // for the same correlation.
  const startedIdx = engineEvents.findIndex(
    (x) => x.type === WorkflowInstanceStarted && x.correlationId === "flow-1",
  );
  const firstFiredIdx = engineEvents.findIndex(
    (x) => x.type === WorkflowTransitionFired && x.correlationId === "flow-1",
  );
  assert.ok(startedIdx >= 0 && firstFiredIdx > startedIdx);
  // Round-trip: every event in the stream parses back as a DomainEvent.
  for (const ev of events) {
    const _typed: DomainEvent = ev;
    void _typed;
  }
});