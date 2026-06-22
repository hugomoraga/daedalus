// AC-5, AC-6, AC-7, AC-8 — projection function tests (pure, no I/O).
// Builds Instance objects in-memory and exercises the three projection
// functions. No filesystem, no engine — these are deterministic unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Instance } from "@daedalus/workflow-engine";
import {
  projectActiveProcesses,
  projectQueueStatus,
  projectWorkflowMetrics,
} from "@daedalus/workflow-engine";

function mkInstance(overrides: Partial<Instance> & Pick<Instance, "id" | "workflowName" | "startedAt" | "updatedAt" | "status">): Instance {
  return {
    workflowVersion: "0.1.0",
    tenantId: "tenant-0",
    currentState: "draft",
    firedTransitionIds: [],
    pendingTransitionId: null,
    history: [],
    lastSeenEventId: null,
    ...overrides,
  };
}

test("AC-5: projectActiveProcesses returns 8-field rows, sorted by ageMs desc", () => {
  const now = "2026-06-22T10:00:00.000Z";
  const instances: Instance[] = [
    mkInstance({
      id: "newer-active",
      workflowName: "lead-to-payment",
      startedAt: "2026-06-22T09:55:00.000Z", // age 5min
      updatedAt: "2026-06-22T09:55:00.000Z",
      status: "active",
      currentState: "approved",
      history: [{ transitionId: "approve", fromState: "draft", toState: "approved", firedAt: "2026-06-22T09:55:00.000Z", triggerEventId: "evt-1" }],
    }),
    mkInstance({
      id: "older-active",
      workflowName: "lead-to-payment",
      startedAt: "2026-06-22T09:00:00.000Z", // age 60min
      updatedAt: "2026-06-22T09:00:00.000Z",
      status: "active",
      currentState: "draft",
    }),
    mkInstance({
      id: "waiting-1",
      workflowName: "lead-to-payment",
      startedAt: "2026-06-22T08:00:00.000Z",
      updatedAt: "2026-06-22T08:00:00.000Z",
      status: "waiting_human",
      currentState: "awaiting_approval",
      pendingTransitionId: "approve",
    }),
    mkInstance({
      id: "completed-old",
      workflowName: "lead-to-payment",
      startedAt: "2026-06-21T08:00:00.000Z",
      updatedAt: "2026-06-21T09:00:00.000Z",
      status: "completed",
      currentState: "paid",
    }),
  ];

  const view = projectActiveProcesses(instances, now);

  // Completed is filtered out — only 3 rows.
  assert.equal(view.length, 3, "filters to live statuses only");

  // Sorted by ageMs desc: oldest at the top.
  assert.equal(view[0].correlationId, "waiting-1");
  assert.equal(view[1].correlationId, "older-active");
  assert.equal(view[2].correlationId, "newer-active");

  // Shape: all 8 fields present, types correct.
  const row = view[0];
  assert.equal(typeof row.correlationId, "string");
  assert.equal(typeof row.workflowName, "string");
  assert.equal(typeof row.workflowVersion, "string");
  assert.equal(typeof row.currentState, "string");
  assert.ok(row.status === "active" || row.status === "waiting_human");
  assert.equal(typeof row.ageMs, "number");
  assert.ok(row.pendingTransitionId === null || typeof row.pendingTransitionId === "string");
  assert.ok(row.lastFiredAt === null || typeof row.lastFiredAt === "string");

  // pendingTransitionId populated when waiting_human, null otherwise.
  const waiting = view.find((r) => r.correlationId === "waiting-1");
  const active = view.find((r) => r.correlationId === "older-active");
  assert.equal(waiting!.pendingTransitionId, "approve");
  assert.equal(active!.pendingTransitionId, null);

  // lastFiredAt: present when history non-empty, null otherwise.
  assert.equal(waiting!.lastFiredAt, null); // no history
  const newer = view.find((r) => r.correlationId === "newer-active");
  assert.equal(newer!.lastFiredAt, "2026-06-22T09:55:00.000Z");
});

test("AC-6: projectQueueStatus groups by workflow, orders by waitingHuman desc then active desc", () => {
  const now = "2026-06-22T10:00:00.000Z";
  const instances: Instance[] = [
    // workflow A: 1 active, 3 waiting_human → top of list
    mkInstance({ id: "a1", workflowName: "wf-a", startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z", status: "active" }),
    mkInstance({ id: "a2", workflowName: "wf-a", startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z", status: "waiting_human" }),
    mkInstance({ id: "a3", workflowName: "wf-a", startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z", status: "waiting_human" }),
    mkInstance({ id: "a4", workflowName: "wf-a", startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:00:00.000Z", status: "waiting_human" }),
    // workflow B: 5 active, 0 waiting_human → second
    ...Array.from({ length: 5 }, (_, i) => mkInstance({
      id: `b${i}`,
      workflowName: "wf-b",
      startedAt: "2026-06-22T09:00:00.000Z",
      updatedAt: "2026-06-22T09:00:00.000Z",
      status: "active",
    })),
    // workflow C: completed within 24h → contributes to totals only
    mkInstance({ id: "c1", workflowName: "wf-c", startedAt: "2026-06-22T08:00:00.000Z", updatedAt: "2026-06-22T09:30:00.000Z", status: "completed" }),
    // workflow D: completed >24h ago → does NOT contribute
    mkInstance({ id: "d1", workflowName: "wf-d", startedAt: "2026-06-20T08:00:00.000Z", updatedAt: "2026-06-20T09:00:00.000Z", status: "completed" }),
  ];

  const queue = projectQueueStatus(instances, now);

  assert.equal(queue.byWorkflow.length, 2, "byWorkflow lists active workflows only (no completed)");
  assert.equal(queue.byWorkflow[0].workflowName, "wf-a");
  assert.equal(queue.byWorkflow[0].waitingHumanCount, 3);
  assert.equal(queue.byWorkflow[0].activeCount, 1);
  assert.equal(queue.byWorkflow[1].workflowName, "wf-b");
  assert.equal(queue.byWorkflow[1].waitingHumanCount, 0);
  assert.equal(queue.byWorkflow[1].activeCount, 5);

  assert.equal(queue.totals.active, 6);
  assert.equal(queue.totals.waitingHuman, 3);
  assert.equal(queue.totals.completed24h, 1, "only the within-24h completion counts");
  assert.equal(queue.totals.compensated24h, 0);
});

test("AC-7: projectWorkflowMetrics filters to [since, now], computes avgCompletionMs", () => {
  const since = "2026-06-22T00:00:00.000Z";
  const now = "2026-06-22T10:00:00.000Z";
  const instances: Instance[] = [
    // 3 completed within window for wf-a, durations 1h, 2h, 3h → avg 2h = 7_200_000ms
    mkInstance({
      id: "a1", workflowName: "wf-a",
      startedAt: "2026-06-22T05:00:00.000Z", updatedAt: "2026-06-22T06:00:00.000Z",
      status: "completed",
      history: [{ transitionId: "t1", fromState: "s1", toState: "s2", firedAt: "2026-06-22T06:00:00.000Z", triggerEventId: "e1" }],
    }),
    mkInstance({
      id: "a2", workflowName: "wf-a",
      startedAt: "2026-06-22T05:00:00.000Z", updatedAt: "2026-06-22T07:00:00.000Z",
      status: "completed",
      history: [{ transitionId: "t2", fromState: "s1", toState: "s2", firedAt: "2026-06-22T07:00:00.000Z", triggerEventId: "e2" }],
    }),
    mkInstance({
      id: "a3", workflowName: "wf-a",
      startedAt: "2026-06-22T05:00:00.000Z", updatedAt: "2026-06-22T08:00:00.000Z",
      status: "completed",
      history: [{ transitionId: "t3", fromState: "s1", toState: "s2", firedAt: "2026-06-22T08:00:00.000Z", triggerEventId: "e3" }],
    }),
    // 1 compensated within window
    mkInstance({ id: "a4", workflowName: "wf-a", startedAt: "2026-06-22T05:00:00.000Z", updatedAt: "2026-06-22T05:30:00.000Z", status: "compensated" }),
    // 1 completed OUTSIDE window (yesterday)
    mkInstance({
      id: "a5", workflowName: "wf-a",
      startedAt: "2026-06-20T05:00:00.000Z", updatedAt: "2026-06-20T06:00:00.000Z",
      status: "completed",
      history: [{ transitionId: "t5", fromState: "s1", toState: "s2", firedAt: "2026-06-20T06:00:00.000Z", triggerEventId: "e5" }],
    }),
    // wf-b: zero completions → avgCompletionMs must be null
    mkInstance({ id: "b1", workflowName: "wf-b", startedAt: "2026-06-22T05:00:00.000Z", updatedAt: "2026-06-22T05:30:00.000Z", status: "compensated" }),
  ];

  const metrics = projectWorkflowMetrics(instances, since, now);

  const wfA = metrics.byWorkflow.find((w) => w.workflowName === "wf-a");
  assert.ok(wfA);
  assert.equal(wfA.completedInWindow, 3);
  assert.equal(wfA.compensatedInWindow, 1);
  assert.equal(wfA.avgCompletionMs, 2 * 60 * 60 * 1000, "avg of 1h, 2h, 3h = 2h");

  const wfB = metrics.byWorkflow.find((w) => w.workflowName === "wf-b");
  assert.ok(wfB);
  assert.equal(wfB.completedInWindow, 0);
  assert.equal(wfB.compensatedInWindow, 1);
  assert.equal(wfB.avgCompletionMs, null, "null when zero completions");

  assert.equal(metrics.totals.completedInWindow, 3);
  assert.equal(metrics.totals.compensatedInWindow, 2);
  assert.equal(metrics.totals.avgCompletionMs, 2 * 60 * 60 * 1000);
  assert.equal(metrics.windowMs, 10 * 60 * 60 * 1000);
});

test("AC-8: projections are pure — same input + same now/since → deep-equal output", () => {
  const now = "2026-06-22T10:00:00.000Z";
  const since = "2026-06-22T00:00:00.000Z";
  const instances: Instance[] = [
    mkInstance({ id: "i1", workflowName: "wf-x", startedAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:30:00.000Z", status: "active" }),
    mkInstance({ id: "i2", workflowName: "wf-x", startedAt: "2026-06-22T08:00:00.000Z", updatedAt: "2026-06-22T08:30:00.000Z", status: "completed" }),
  ];

  const a1 = projectActiveProcesses(instances, now);
  const a2 = projectActiveProcesses(instances, now);
  assert.deepEqual(a1, a2);

  const q1 = projectQueueStatus(instances, now);
  const q2 = projectQueueStatus(instances, now);
  assert.deepEqual(q1, q2);

  const m1 = projectWorkflowMetrics(instances, since, now);
  const m2 = projectWorkflowMetrics(instances, since, now);
  assert.deepEqual(m1, m2);
});
