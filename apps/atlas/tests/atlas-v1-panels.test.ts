// v1 panels — Throughput + Monitoring.
// Spec 007 §v1: panels whose backing model only lands once Revenue Visibility v1 is stable.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import { seedTenant, clearAll, makeFlow, useTempDataDir, type SeedEvent } from "./helpers.ts";

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
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function revenueEvents(): SeedEvent[] {
  // Minimal revenue stream: 1 estimate created, confirmed, received.
  const t = "2026-06-20T12:00:00.000Z";
  return [
    { eventId: "r1", type: "RevenueEstimateCreated", tenantId: "tenant-0", occurredAt: t, actor: "cli", causationId: null, correlationId: "c-rv", payload: { estimateId: "est-1", label: "x", amount: 10000, currency: "CLP", state: "expected" } },
    { eventId: "r2", type: "RevenueConfirmed", tenantId: "tenant-0", occurredAt: t, actor: "cli", causationId: "r1", correlationId: "c-rv", payload: { estimateId: "est-1" } },
    { eventId: "r3", type: "RevenueReceived", tenantId: "tenant-0", occurredAt: t, actor: "cli", causationId: "r2", correlationId: "c-rv", payload: { estimateId: "est-1" } },
    { eventId: "r4", type: "ExpenseRegistered", tenantId: "tenant-0", occurredAt: t, actor: "cli", causationId: null, correlationId: "c-exp", payload: { expenseId: "exp-1", label: "cloud", amount: 2000, currency: "CLP" } },
  ];
}

test("atlas v1: throughput panel renders SVG bars for multi-day events", async () => {
  await clearAll();
  const events = [
    ...makeFlow("tenant-0", "c-day1", ["LeadCreated", "LeadQualified"]),
    ...makeFlow("tenant-0", "c-day2", ["ProposalGenerated", "ProposalSubmitted", "ProposalApproved"]),
    ...makeFlow("tenant-0", "c-day3", ["ProjectCreated", "ProjectDelivered", "InvoiceIssued", "InvoiceSent"]),
  ];
  // Make day2 + day3 different from day1
  events[1].occurredAt = "2026-06-19T10:00:00.000Z";
  events[3].occurredAt = "2026-06-20T10:00:00.000Z";
  await seedTenant("tenant-0", events);

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/throughput");
    assert.equal(res.status, 200);
    assert.match(res.body, /<svg /);
    assert.match(res.body, /<rect /);
    assert.match(res.body, /Throughput/);
  } finally {
    server.close();
    await clearAll();
  }
});

test("atlas v1: throughput panel shows empty-state when no events", async () => {
  await clearAll();
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/throughput");
    assert.equal(res.status, 200);
    assert.match(res.body, /bars will appear/);
    assert.doesNotMatch(res.body, /<svg /);
  } finally {
    server.close();
    await clearAll();
  }
});

test("atlas v1: monitoring panel renders FinancialSummary + currency", async () => {
  await clearAll();
  await seedTenant("tenant-0", revenueEvents());

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/monitoring");
    assert.equal(res.status, 200);
    assert.match(res.body, /Monitoring/);
    assert.match(res.body, /Expected/);
    assert.match(res.body, /Confirmed/);
    assert.match(res.body, /Received/);
    assert.match(res.body, /Runway/);
    assert.match(res.body, /CLP/);
  } finally {
    server.close();
    await clearAll();
  }
});

test("atlas v1: monitoring panel renders gracefully with no events", async () => {
  await clearAll();
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/monitoring");
    assert.equal(res.status, 200);
    assert.match(res.body, /Monitoring/);
    assert.match(res.body, /UNKNOWN/);
  } finally {
    server.close();
    await clearAll();
  }
});

test("atlas v1: monitoring is tenant-isolated (different currency per tenant)", async () => {
  await clearAll();
  // tenant-0 with revenue
  await seedTenant("tenant-0", [
    { eventId: "r1", type: "RevenueEstimateCreated", tenantId: "tenant-0", occurredAt: "2026-06-20T10:00:00.000Z", actor: "cli", causationId: null, correlationId: "c", payload: { estimateId: "e1", label: "x", amount: 5000, currency: "CLP", state: "expected" } },
  ]);
  // tenant-other with different currency
  await seedTenant("tenant-other", [
    { eventId: "r2", type: "RevenueEstimateCreated", tenantId: "tenant-other", occurredAt: "2026-06-20T10:00:00.000Z", actor: "cli", causationId: null, correlationId: "c", payload: { estimateId: "e1", label: "x", amount: 5000, currency: "USD", state: "expected" } },
  ]);

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const a = await get(server, "/t/tenant-0/monitoring");
    const b = await get(server, "/t/tenant-other/monitoring");
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.match(a.body, /CLP/);
    assert.match(b.body, /USD/);
    assert.doesNotMatch(a.body, /USD/);
    assert.doesNotMatch(b.body, /CLP/);
  } finally {
    server.close();
    await clearAll();
  }
});