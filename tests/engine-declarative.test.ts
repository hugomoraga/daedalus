// AC-1 (Spec 008): declarative advancement.
// Given a workflow with a transition LeadQualified -> qualified,
// When a LeadQualified event arrives for a tenant with no existing instance,
// Then the engine creates an instance, emits WorkflowInstanceStarted, and advances to qualified.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps } from "./helpers.ts";
import {
  WorkflowInstanceStarted,
  WorkflowTransitionFired,
} from "@daedalus/workflow-engine";

test("AC-1: LeadQualified creates an instance and advances state", async () => {
  const e = makeEngineDeps();
  await e.append({
    eventId: "evt-1",
    type: "LeadCreated",
    tenantId: e.tenantId,
    occurredAt: "2026-06-21T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: { leadId: "lead-1", customer: "Acme" },
  });
  await e.append({
    eventId: "evt-2",
    type: "LeadQualified",
    tenantId: e.tenantId,
    occurredAt: "2026-06-21T00:00:01.000Z",
    actor: "test",
    causationId: "evt-1",
    correlationId: "flow-1",
    payload: { leadId: "lead-1" },
  });
  await e.runFor(300);

  const events = await e.readStream(e.tenantId);
  const started = events.find((x) => x.type === WorkflowInstanceStarted);
  assert.ok(started, "WorkflowInstanceStarted emitted");
  assert.equal(started!.payload.workflowName, "lead-to-payment");
  assert.equal(started!.payload.initialState, "draft");
  assert.equal(started!.payload.triggerEventType, "LeadQualified");
  assert.equal(started!.causationId, "evt-2");
  assert.equal(started!.correlationId, "flow-1");

  const fired = events.find((x) => x.type === WorkflowTransitionFired);
  assert.ok(fired, "WorkflowTransitionFired emitted");
  assert.equal(fired!.payload.fromState, "draft");
  assert.equal(fired!.payload.toState, "qualified");
});