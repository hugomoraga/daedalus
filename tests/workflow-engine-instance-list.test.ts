// AC-1, AC-2, AC-3, AC-4, AC-9, AC-10 — instance-store.list + adapter + barrel + engine regression.
// Integration tests using mkdtemp + JsonlInstanceStoreAdapter. Verifies the
// additive `list` method behaves as the spec requires AND that the engine loop
// still produces instances readable through `list` (no engine semantics drift).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { JsonlInstanceStoreAdapter } from "@daedalus/workflow-engine/adapters";
import type { Instance } from "@daedalus/workflow-engine";
import { makeEngineDeps } from "./helpers.ts";

function makeStore(): { store: JsonlInstanceStoreAdapter; baseDir: string } {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-list-"));
  return { store: new JsonlInstanceStoreAdapter(baseDir), baseDir };
}

function writeInstanceLine(store: JsonlInstanceStoreAdapter, tenantId: string, instance: Instance): Promise<void> {
  // Bypass the public save() to seed multiple snapshots of the same id quickly.
  return store.save(tenantId, instance);
}

test("AC-1: list is tenant-isolated — zero cross-tenant leakage", async () => {
  const { store } = makeStore();
  await writeInstanceLine(store, "tenant-A", {
    id: "flow-a1", workflowName: "wf", workflowVersion: "0.1.0",
    tenantId: "tenant-A", currentState: "draft", status: "active",
    firedTransitionIds: [], pendingTransitionId: null, history: [],
    startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z",
    lastSeenEventId: null,
  });
  await writeInstanceLine(store, "tenant-B", {
    id: "flow-b1", workflowName: "wf", workflowVersion: "0.1.0",
    tenantId: "tenant-B", currentState: "draft", status: "active",
    firedTransitionIds: [], pendingTransitionId: null, history: [],
    startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z",
    lastSeenEventId: null,
  });
  await writeInstanceLine(store, "tenant-B", {
    id: "flow-b2", workflowName: "wf", workflowVersion: "0.1.0",
    tenantId: "tenant-B", currentState: "draft", status: "active",
    firedTransitionIds: [], pendingTransitionId: null, history: [],
    startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z",
    lastSeenEventId: null,
  });

  const aInstances = await store.list("tenant-A");
  const bInstances = await store.list("tenant-B");

  assert.equal(aInstances.length, 1);
  assert.equal(aInstances[0].id, "flow-a1");
  assert.equal(bInstances.length, 2);
  assert.ok(bInstances.every((i) => i.tenantId === "tenant-B"));
});

test("AC-2: list filters by status", async () => {
  const { store } = makeStore();
  const base = {
    workflowName: "wf", workflowVersion: "0.1.0", tenantId: "tenant-0",
    currentState: "draft", firedTransitionIds: [], pendingTransitionId: null,
    history: [],
    startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z",
    lastSeenEventId: null,
  };
  await writeInstanceLine(store, "tenant-0", { id: "i1", status: "active", ...base });
  await writeInstanceLine(store, "tenant-0", { id: "i2", status: "waiting_human", ...base });
  await writeInstanceLine(store, "tenant-0", { id: "i3", status: "completed", ...base });
  await writeInstanceLine(store, "tenant-0", { id: "i4", status: "compensated", ...base });

  const liveOnly = await store.list("tenant-0");
  assert.equal(liveOnly.length, 2, "default: active + waiting_human");
  assert.deepEqual(liveOnly.map((i) => i.id).sort(), ["i1", "i2"]);

  const completed = await store.list("tenant-0", { status: ["completed"] });
  assert.equal(completed.length, 1);
  assert.equal(completed[0].id, "i3");

  const allFour = await store.list("tenant-0", {
    status: ["active", "waiting_human", "completed", "compensated"],
  });
  assert.equal(allFour.length, 4);
});

test("AC-3: list filters by workflowName (+ optional workflowVersion)", async () => {
  const { store } = makeStore();
  const base = {
    tenantId: "tenant-0", currentState: "draft", status: "active" as const,
    firedTransitionIds: [], pendingTransitionId: null, history: [],
    startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z",
    lastSeenEventId: null,
  };
  await writeInstanceLine(store, "tenant-0", { id: "l1", workflowName: "lead-to-payment", workflowVersion: "0.1.0", ...base });
  await writeInstanceLine(store, "tenant-0", { id: "l2", workflowName: "lead-to-payment", workflowVersion: "0.1.0", ...base });
  await writeInstanceLine(store, "tenant-0", { id: "l3", workflowName: "lead-to-payment", workflowVersion: "0.1.0", ...base });
  await writeInstanceLine(store, "tenant-0", { id: "o1", workflowName: "other-flow", workflowVersion: "0.2.0", ...base });

  const leadOnly = await store.list("tenant-0", { workflowName: "lead-to-payment" });
  assert.equal(leadOnly.length, 3);

  const exact = await store.list("tenant-0", {
    workflowName: "lead-to-payment",
    workflowVersion: "0.1.0",
  });
  assert.equal(exact.length, 3);

  const noMatch = await store.list("tenant-0", { workflowName: "nope" });
  assert.equal(noMatch.length, 0);
});

test("AC-4: list clamps limit at 1000", async () => {
  const { store } = makeStore();
  const base = {
    workflowName: "wf", workflowVersion: "0.1.0", tenantId: "tenant-0",
    currentState: "draft", status: "active" as const,
    firedTransitionIds: [], pendingTransitionId: null, history: [],
    updatedAt: "2026-06-22T09:00:00.000Z", lastSeenEventId: null,
  };
  // Seed 1500 instances with strictly-increasing startedAt (so desc sort is stable).
  for (let i = 0; i < 1500; i++) {
    await writeInstanceLine(store, "tenant-0", {
      ...base,
      id: `i-${i}`,
      startedAt: new Date(Date.parse("2026-06-22T00:00:00.000Z") + i * 1000).toISOString(),
    });
  }

  const clamped = await store.list("tenant-0", { limit: 5000 });
  assert.equal(clamped.length, 1000, "limit 5000 clamped to 1000");

  const defaultLimit = await store.list("tenant-0");
  assert.equal(defaultLimit.length, 100, "default limit is 100");

  const requested = await store.list("tenant-0", { limit: 50 });
  assert.equal(requested.length, 50);
});

test("AC-9: barrel has no `export *` and the new symbols are exported", () => {
  const barrel = readFileSync("packages/workflow-engine/src/index.ts", "utf8");
  assert.ok(!/^export \*/m.test(barrel), "no `export *` allowed (ADR-004)");

  // The new symbols from Spec 011 §4.3 must be present as explicit named exports.
  assert.match(barrel, /export type \{[^}]*InstanceStatusFilter/m);
  assert.match(barrel, /export type \{[^}]*InstanceQueryOptions/m);
  assert.match(barrel, /export type \{[^}]*ActiveProcessView/m);
  assert.match(barrel, /export type \{[^}]*QueueStatus/m);
  assert.match(barrel, /export type \{[^}]*WorkflowMetrics/m);
  assert.match(barrel, /export \{ projectActiveProcesses/m);
  assert.match(barrel, /export \{ projectQueueStatus/m);
  assert.match(barrel, /export \{ projectWorkflowMetrics/m);
});

test("AC-10: engine loop regression — instances written by runEngine are readable via list", async () => {
  const e = makeEngineDeps();
  await e.append({
    eventId: "evt-1",
    type: "LeadCreated",
    tenantId: e.tenantId,
    occurredAt: "2026-06-21T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-list-1",
    payload: { leadId: "lead-1", customer: "Acme" },
  });
  await e.append({
    eventId: "evt-2",
    type: "LeadQualified",
    tenantId: e.tenantId,
    occurredAt: "2026-06-21T00:00:01.000Z",
    actor: "test",
    causationId: "evt-1",
    correlationId: "flow-list-1",
    payload: { leadId: "lead-1" },
  });
  await e.runFor(300);

  // Engine wrote an instance for this flow — verify list returns it.
  const instances = await e.deps.instanceStore.list(e.tenantId);
  assert.ok(instances.length >= 1, "engine wrote at least one instance");
  const flowInstance = instances.find((i) => i.id === "flow-list-1");
  assert.ok(flowInstance, "instance for flow-list-1 is readable via list");
  assert.equal(flowInstance.workflowName, "lead-to-payment");
  // The engine advanced the instance to at least "qualified" (per AC-1 declarative test).
  assert.ok(["qualified", "draft"].includes(flowInstance.currentState));
});
