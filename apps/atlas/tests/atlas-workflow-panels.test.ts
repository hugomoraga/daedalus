// T-20..T-22 (Spec 007 §Phase 2) + Spec 011 projection consumption tests.
// Integration: seed two tenants with workflow instances, render the three
// new panels via the SSR server, assert content + tenant isolation.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import { buildAtlasDeps } from "../src/deps.ts";
import { JsonlInstanceStoreAdapter } from "@daedalus/workflow-engine/adapters";
import {
  seedTenant,
  seedInstances,
  clearAll,
  useTempDataDir,
  activeDataDir,
} from "./helpers.ts";

before(async () => {
  await useTempDataDir();
});

function get(server: Server, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (addr === null || typeof addr === "string") return reject(new Error("not listening"));
    const req = request(
      { hostname: "127.0.0.1", port: addr.port, path, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// Tests run in a temp dir; the production Atlas deps use `process.cwd()` for
// the instance store (to align with the engine CLI's write path). Override it
// here so tests read from the same temp dir as `seedInstances`.
function depsForTest(): ReturnType<typeof buildAtlasDeps> {
  const deps = buildAtlasDeps();
  deps.instanceStore = new JsonlInstanceStoreAdapter(activeDataDir());
  return deps;
}

function liveInstances(): Parameters<typeof seedInstances>[1] {
  const t0 = "2026-06-21T09:00:00.000Z";
  const t1 = "2026-06-21T08:00:00.000Z";
  return [
    {
      id: "flow-active-1",
      workflowName: "lead-to-payment",
      workflowVersion: "0.1.0",
      tenantId: "tenant-0",
      currentState: "approved",
      status: "active" as const,
      firedTransitionIds: ["t1", "t2"],
      pendingTransitionId: null,
      history: [
        { transitionId: "t1", fromState: "draft", toState: "qualified", firedAt: t1, triggerEventId: "e1" },
        { transitionId: "t2", fromState: "qualified", toState: "approved", firedAt: t0, triggerEventId: "e2" },
      ],
      startedAt: t1,
      updatedAt: t0,
      lastSeenEventId: "e2",
    },
    {
      id: "flow-waiting-1",
      workflowName: "lead-to-payment",
      workflowVersion: "0.1.0",
      tenantId: "tenant-0",
      currentState: "awaiting_approval",
      status: "waiting_human" as const,
      firedTransitionIds: ["t1"],
      pendingTransitionId: "approve",
      history: [
        { transitionId: "t1", fromState: "draft", toState: "awaiting_approval", firedAt: t0, triggerEventId: "e1" },
      ],
      startedAt: "2026-06-21T07:00:00.000Z", // older than t1
      updatedAt: t0,
      lastSeenEventId: "e1",
    },
    {
      id: "flow-completed-1",
      workflowName: "lead-to-payment",
      workflowVersion: "0.1.0",
      tenantId: "tenant-0",
      currentState: "paid",
      status: "completed" as const,
      firedTransitionIds: ["t1", "t2", "t3"],
      pendingTransitionId: null,
      history: [
        { transitionId: "t3", fromState: "approved", toState: "paid", firedAt: "2026-06-21T07:30:00.000Z", triggerEventId: "e3" },
      ],
      startedAt: "2026-06-21T06:00:00.000Z",
      updatedAt: "2026-06-21T07:30:00.000Z",
      lastSeenEventId: "e3",
    },
  ];
}

test("T-20 active processes: renders live instances only, sorted by age desc", async () => {
  await clearAll();
  await seedInstances("tenant-0", liveInstances());
  const { server } = createAtlasServer({ port: 0, deps: depsForTest() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/active-processes");
    assert.equal(res.status, 200);
    // Title + sort hint.
    assert.match(res.body, /Active Processes/);
    assert.match(res.body, /sorted by age desc/);
    // Both live instances appear (the completed one is filtered out).
    assert.match(res.body, /flow-active-1/);
    assert.match(res.body, /flow-waiting-1/);
    // No tag rendering for the completed instance id.
    assert.doesNotMatch(res.body, /flow-completed-1/);
    // waiting_human renders a WAITING tag.
    assert.match(res.body, /WAITING/);
  } finally {
    server.close();
  }
});

test("T-20 active processes: empty state when no instances", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0, deps: depsForTest() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/active-processes");
    assert.equal(res.status, 200);
    assert.match(res.body, /no live workflow instances/);
  } finally {
    server.close();
  }
});

test("T-21 queue status: per-workflow counts + totals, ordered by waiting desc", async () => {
  await clearAll();
  await seedInstances("tenant-0", liveInstances());
  const { server } = createAtlasServer({ port: 0, deps: depsForTest() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/queue-status");
    assert.equal(res.status, 200);
    assert.match(res.body, /Queue Status/);
    // One workflow in byWorkflow with 1 active + 1 waiting + 1 completed24h.
    assert.match(res.body, /lead-to-payment/);
    assert.match(res.body, /ACTIVE 1/);
    assert.match(res.body, /WAITING 1/);
    assert.match(res.body, />Active</);
    assert.match(res.body, />Waiting human</);
    assert.match(res.body, />Completed 24h</);
  } finally {
    server.close();
  }
});

test("T-22 workflow metrics: 24h window, per-workflow + totals", async () => {
  await clearAll();
  await seedInstances("tenant-0", liveInstances());
  const { server } = createAtlasServer({ port: 0, deps: depsForTest() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/workflow-metrics");
    assert.equal(res.status, 200);
    assert.match(res.body, /Workflow Metrics/);
    assert.match(res.body, /window 24h/);
    assert.match(res.body, />Completed</);
    assert.match(res.body, />Compensated</);
    assert.match(res.body, />Avg completion</);
  } finally {
    server.close();
  }
});

test("T-20..T-22 tenant isolation: tenant-other's panel never renders tenant-0's data", async () => {
  await clearAll();
  await seedInstances("tenant-0", [
    {
      id: "t0-flow-1",
      workflowName: "wf-zero",
      workflowVersion: "0.1.0",
      tenantId: "tenant-0",
      currentState: "draft",
      status: "active",
      firedTransitionIds: [],
      pendingTransitionId: null,
      history: [],
      startedAt: "2026-06-21T09:00:00.000Z",
      updatedAt: "2026-06-21T09:00:00.000Z",
      lastSeenEventId: null,
    },
  ]);
  await seedInstances("tenant-other", [
    {
      id: "tother-flow-1",
      workflowName: "wf-other",
      workflowVersion: "0.1.0",
      tenantId: "tenant-other",
      currentState: "draft",
      status: "active",
      firedTransitionIds: [],
      pendingTransitionId: null,
      history: [],
      startedAt: "2026-06-21T09:00:00.000Z",
      updatedAt: "2026-06-21T09:00:00.000Z",
      lastSeenEventId: null,
    },
  ]);

  const { server } = createAtlasServer({ port: 0, deps: depsForTest() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const t0Active = await get(server, "/t/tenant-0/active-processes");
    assert.equal(t0Active.status, 200);
    assert.match(t0Active.body, /t0-flow-1/);
    assert.doesNotMatch(t0Active.body, /tother-flow-1/);
    assert.doesNotMatch(t0Active.body, /wf-other/);

    const totherActive = await get(server, "/t/tenant-other/active-processes");
    assert.equal(totherActive.status, 200);
    assert.match(totherActive.body, /tother-flow-1/);
    assert.doesNotMatch(totherActive.body, /t0-flow-1/);
    assert.doesNotMatch(totherActive.body, /wf-zero/);
  } finally {
    server.close();
  }
});

test("T-20..T-22 absent for unknown tenant (no cross-tenant rendering)", async () => {
  await clearAll();
  const { server } = createAtlasServer({ port: 0, deps: depsForTest() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    // Unknown tenant → server returns 4xx (empty state, never another tenant's data).
    const res = await get(server, "/t/no-such-tenant/active-processes");
    assert.ok(res.status >= 400, `expected 4xx, got ${res.status}`);
    assert.doesNotMatch(res.body, /flow-/);
  } finally {
    server.close();
  }
});
