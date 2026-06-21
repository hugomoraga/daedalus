// AC-7 (Spec 008): multi-tenant isolation.
// Two tenants, each running their own workflow, must not leak instances or events.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps } from "./helpers.ts";
import { WorkflowInstanceStarted } from "@daedalus/workflow-engine";

test("AC-7: tenant A's workflow instances do not see tenant B's events", async () => {
  const a = makeEngineDeps({ tenantId: "tenant-A" });
  const b = makeEngineDeps({ tenantId: "tenant-B" });

  await a.append({
    eventId: "a-1",
    type: "LeadQualified",
    tenantId: a.tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-A",
    payload: {},
  });
  await b.append({
    eventId: "b-1",
    type: "LeadQualified",
    tenantId: b.tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-B",
    payload: {},
  });

  await Promise.all([a.runFor(200), b.runFor(200)]);

  const eventsA = await a.readStream(a.tenantId);
  const eventsB = await b.readStream(b.tenantId);

  const startedA = eventsA.filter((e) => e.type === WorkflowInstanceStarted);
  const startedB = eventsB.filter((e) => e.type === WorkflowInstanceStarted);
  assert.equal(startedA.length, 1);
  assert.equal(startedA[0].correlationId, "flow-A");
  assert.equal(startedB.length, 1);
  assert.equal(startedB[0].correlationId, "flow-B");

  // Tenant A must not see tenant B's events.
  assert.equal(eventsA.some((e) => e.tenantId === b.tenantId), false);
  assert.equal(eventsB.some((e) => e.tenantId === a.tenantId), false);

  // Each tenant's instance store has only its own instance.
  const instA = await a.deps.instanceStore.findByCorrelationId(a.tenantId, "flow-A");
  const instB = await b.deps.instanceStore.findByCorrelationId(b.tenantId, "flow-B");
  assert.equal(instA.length, 1);
  assert.equal(instB.length, 1);
  // Cross-lookup must return nothing.
  const crossA = await b.deps.instanceStore.findByCorrelationId(b.tenantId, "flow-A");
  assert.equal(crossA.length, 0, "tenant B's instance store must not return tenant A's instance");
});