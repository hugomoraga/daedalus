// AC-12 (Spec 007 v1.2) — Welcome panel enrichment.
// Integration: seed workflow instances + obligation events for two tenants,
// render the Welcome panel via the SSR server, assert the 2x3 grid layout
// + tone for the "needs attention" tiles + tenant isolation.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import { buildAtlasDeps } from "../src/deps.ts";
import {
  seedTenant,
  seedInstances,
  clearAll,
  useTempDataDir,
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

// All event timestamps are computed relative to `now` so the panel's
// `asOf = new Date().toISOString()` always lands in a coherent relation
// to the seeded `dueAt`s. The previous version hardcoded "2026-06-22" T0
// and absolute dueAt strings ("2026-07-01", "2026-06-10"); once wall-clock
// drifted past 2026-07-01 the 'pending' obligation silently flipped to
// 'missed' and the test failed with no diagnostic.
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const T0 = new Date(NOW - 12 * DAY_MS).toISOString();
const DUE_PENDING = new Date(NOW + 9 * DAY_MS).toISOString();
const DUE_MISSED = new Date(NOW - 12 * DAY_MS).toISOString();
const DUE_MISSED_OTHER = new Date(NOW - 30 * DAY_MS).toISOString();

function obligationEvent(partial: { id: string; type: string; tenantId?: string; dueAt: string; humanName: string; payload?: Record<string, unknown> }) {
  return {
    eventId: `${partial.id}-due`,
    type: partial.type,
    tenantId: partial.tenantId ?? "tenant-0",
    occurredAt: T0,
    actor: "engine",
    causationId: null,
    correlationId: `c-${partial.id}`,
    payload: {
      obligationId: partial.id,
      obligationHumanName: partial.humanName,
      triggerEventId: `evt-${partial.id}`,
      triggerEventType: "InvoiceIssued",
      dueAt: partial.dueAt,
      ruleSetId: "test-rules",
      ruleSetVersion: "0.1.0",
      requiredHumanAction: "file",
      ...(partial.payload ?? {}),
    },
  };
}

test("AC-12: Welcome panel renders the 2x3 grid with the 'what needs attention' row", async () => {
  await clearAll();
  // 2 active, 1 waiting, 0 missed, 1 pending
  await seedInstances("tenant-0", [
    {
      id: "flow-active-1", workflowName: "lead-to-payment", workflowVersion: "0.1.0",
      tenantId: "tenant-0", currentState: "approved", status: "active",
      firedTransitionIds: [], pendingTransitionId: null, history: [],
      startedAt: T0, updatedAt: T0, lastSeenEventId: null,
    },
    {
      id: "flow-active-2", workflowName: "lead-to-payment", workflowVersion: "0.1.0",
      tenantId: "tenant-0", currentState: "draft", status: "active",
      firedTransitionIds: [], pendingTransitionId: null, history: [],
      startedAt: T0, updatedAt: T0, lastSeenEventId: null,
    },
    {
      id: "flow-waiting-1", workflowName: "lead-to-payment", workflowVersion: "0.1.0",
      tenantId: "tenant-0", currentState: "awaiting_approval", status: "waiting_human",
      firedTransitionIds: [], pendingTransitionId: "approve", history: [],
      startedAt: T0, updatedAt: T0, lastSeenEventId: null,
    },
  ]);
  await seedTenant("tenant-0", [
    obligationEvent({ id: "obl-pending", type: "ObligationDue", dueAt: DUE_PENDING, humanName: "Pending IVA" }),
    obligationEvent({ id: "obl-missed", type: "ObligationDue", dueAt: DUE_MISSED, humanName: "Missed F22" }),
  ]);

  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    // Section labels
    assert.match(res.body, /What needs attention/);
    assert.match(res.body, /General health/);
    // Primary row tiles
    assert.match(res.body, />Active workflows</);
    assert.match(res.body, />Waiting human</);
    assert.match(res.body, />Pending obligations</);
    // Secondary row tiles
    assert.match(res.body, />Missed obligations</);
    assert.match(res.body, />Last event at</);
    assert.match(res.body, />Total events</);
    // Values
    // Active workflows = "live" slice = status active + status waiting_human
    // (the panel reads `projectActiveProcesses(...)` which explicitly filters
    // to LIVE_STATUSES = {active, waiting_human}; see Spec 011 §4.2 / AC-5).
    // With this seed (2 active + 1 waiting_human) → 3 live workflows.
    // The "Waiting human" tile below subtracts waiting_human from the count.
    assert.match(res.body, />Active workflows<\/div>\s*<div[^>]*>3<\/div>/);
    assert.match(res.body, />Waiting human<\/div>\s*<div[^>]*>1<\/div>/);
    assert.match(res.body, />Pending obligations<\/div>\s*<div[^>]*>1<\/div>/);
    assert.match(res.body, /stalled at human gate/); // waiting human tone text
    assert.match(res.body, />Missed obligations<\/div>\s*<div[^>]*>1<\/div>/);
    assert.match(res.body, /action required/); // missed tone text
  } finally {
    server.close();
  }
});

test("AC-12: Welcome panel uses neutral tones when counts are zero (no false alarms)", async () => {
  await clearAll();
  // No workflow instances, no obligation events → all zero
  await seedTenant("tenant-0", []);
  await seedInstances("tenant-0", []);

  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    // Tiles show 0
    assert.match(res.body, /<div[^>]*>0<\/div>/);
    // No alarm text — neutral subtext instead
    assert.match(res.body, /no humans needed/);
    assert.match(res.body, /all on track/);
    // No alert/warn class leaks into neutral state
    assert.doesNotMatch(res.body, /action required/);
    assert.doesNotMatch(res.body, /stalled at human gate/);
  } finally {
    server.close();
  }
});

test("AC-12: Welcome panel tenant isolation — tenant-other's data never leaks into tenant-0's panel", async () => {
  await clearAll();
  // tenant-0: 0 workflow, 0 obligations
  await seedTenant("tenant-0", []);
  await seedInstances("tenant-0", []);
  // tenant-other: 5 active workflows, 1 missed obligation
  await seedInstances("tenant-other", [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `tother-flow-${i}`, workflowName: "wf-other", workflowVersion: "0.1.0",
      tenantId: "tenant-other", currentState: "draft", status: "active" as const,
      firedTransitionIds: [], pendingTransitionId: null, history: [],
      startedAt: T0, updatedAt: T0, lastSeenEventId: null,
    })),
  ]);
  await seedTenant("tenant-other", [
    obligationEvent({
      id: "tother-obl-missed", type: "ObligationDue",
      tenantId: "tenant-other",
      dueAt: DUE_MISSED_OTHER,
      humanName: "Other tenant's missed",
    }),
  ]);

  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const t0 = await get(server, "/t/tenant-0/welcome");
    assert.equal(t0.status, 200);
    // tenant-0 panel must NOT show other tenant's data.
    assert.doesNotMatch(t0.body, /Other tenant/);
    assert.doesNotMatch(t0.body, /tother-flow-/);
    // tenant-0's "active workflows" stays 0 (not 5).
    // The Active workflows tile is the first metric in the primary row.
    const activeSection = t0.body.match(/Active workflows[\s\S]{0,200}/)?.[0] ?? "";
    assert.match(activeSection, />0</);
    assert.doesNotMatch(activeSection, />5</);

    const tother = await get(server, "/t/tenant-other/welcome");
    assert.equal(tother.status, 200);
    assert.match(tother.body, /action required/);
  } finally {
    server.close();
  }
});
