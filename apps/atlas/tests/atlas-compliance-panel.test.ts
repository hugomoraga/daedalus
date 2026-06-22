// T-23 — Compliance panel (Spec 007 AC-9 / AC-10 / AC-11).
// Integration: seed obligation events for two tenants, render the panel via
// the SSR server, assert shape + grouping + tenant isolation.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import {
  seedTenant,
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

type ObligationEvent = {
  eventId: string;
  type: string;
  tenantId: string;
  occurredAt: string;
  actor: string;
  causationId: string | null;
  correlationId: string;
  payload: Record<string, unknown>;
};

// Seed: 1 pending (due in 30d), 1 due-soon (due in 3d), 1 met, 1 missed.
function complianceEvents(): ObligationEvent[] {
  const t0 = "2026-06-21T09:00:00.000Z";
  const duePending = "2026-07-21T00:00:00.000Z";
  const dueSoon = "2026-06-24T00:00:00.000Z";
  const dueMissed = "2026-06-15T00:00:00.000Z";
  return [
    // 1. Pending far future
    {
      eventId: "obl-1-due", type: "ObligationDue", tenantId: "tenant-0",
      occurredAt: t0, actor: "engine", causationId: null, correlationId: "c-1",
      payload: {
        obligationId: "obl-iva-monthly",
        obligationHumanName: "Monthly IVA filing",
        triggerEventId: "evt-1",
        triggerEventType: "InvoiceIssued",
        dueAt: duePending,
        ruleSetId: "sii-iva-2026",
        ruleSetVersion: "0.1.0",
        requiredHumanAction: "file",
      },
    },
    // 2. Due-soon + has an evaluation recorded
    {
      eventId: "obl-2-due", type: "ObligationDue", tenantId: "tenant-0",
      occurredAt: t0, actor: "engine", causationId: null, correlationId: "c-2",
      payload: {
        obligationId: "obl-retention-monthly",
        obligationHumanName: "Monthly tax retention",
        triggerEventId: "evt-2",
        triggerEventType: "PaymentReceived",
        dueAt: dueSoon,
        ruleSetId: "sii-retention-2026",
        ruleSetVersion: "0.2.0",
        requiredHumanAction: "pay",
      },
    },
    {
      eventId: "obl-2-eval", type: "ObligationEvaluationRecorded", tenantId: "tenant-0",
      occurredAt: t0, actor: "policy-engine", causationId: "obl-2-due", correlationId: "c-2",
      payload: {
        obligationId: "obl-retention-monthly",
        outcome: "escalate",
        reason: "amount exceeds conservative threshold; route to founder for sign-off",
        policyRef: { policyId: "tax-compliance-policy", version: "0.1.0" },
        ruleId: "high-value-amount",
        gateRef: "founder-approval",
      },
    },
    // 3. Met (due in past, then met)
    {
      eventId: "obl-3-due", type: "ObligationDue", tenantId: "tenant-0",
      occurredAt: "2026-06-10T09:00:00.000Z", actor: "engine", causationId: null, correlationId: "c-3",
      payload: {
        obligationId: "obl-ppd",
        obligationHumanName: "PPD annual filing",
        triggerEventId: "evt-3",
        triggerEventType: "InvoiceIssued",
        dueAt: dueMissed,
        ruleSetId: "sii-ppd-2026",
        ruleSetVersion: "0.1.0",
        requiredHumanAction: "file",
      },
    },
    {
      eventId: "obl-3-met", type: "ObligationMet", tenantId: "tenant-0",
      occurredAt: "2026-06-12T09:00:00.000Z", actor: "founder", causationId: "obl-3-due", correlationId: "c-3",
      payload: { obligationId: "obl-ppd" },
    },
    // 4. Missed (due in past, no met event)
    {
      eventId: "obl-4-due", type: "ObligationDue", tenantId: "tenant-0",
      occurredAt: "2026-05-15T09:00:00.000Z", actor: "engine", causationId: null, correlationId: "c-4",
      payload: {
        obligationId: "obl-f22",
        obligationHumanName: "F22 annual return",
        triggerEventId: "evt-4",
        triggerEventType: "InvoiceIssued",
        dueAt: dueMissed,
        ruleSetId: "sii-f22-2026",
        ruleSetVersion: "0.1.0",
        requiredHumanAction: "file",
      },
    },
  ];
}

test("AC-9: compliance panel renders obligations grouped by status with totals", async () => {
  await clearAll();
  await seedTenant("tenant-0", complianceEvents());
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/compliance");
    assert.equal(res.status, 200);
    // Title + asOf anchor
    assert.match(res.body, /Compliance/);
    assert.match(res.body, /asOf /);
    // Totals row (1 pending, 1 met, 1 missed; the due-soon overlaps with pending)
    assert.match(res.body, />Pending</);
    assert.match(res.body, />Met</);
    assert.match(res.body, />Missed</);
    // Sections: due-soon appears (one is due in 3 days), missed present, met present
    assert.match(res.body, /Due in next 7 days/);
    assert.match(res.body, /Missed — action required/);
    assert.match(res.body, />Met</);
    // All obligation names appear
    assert.match(res.body, /Monthly IVA filing/);
    assert.match(res.body, /Monthly tax retention/);
    assert.match(res.body, /PPD annual filing/);
    assert.match(res.body, /F22 annual return/);
    // Provenance: rule set + version visible for at least one
    assert.match(res.body, /sii-iva-2026@0\.1\.0/);
    // Evaluation line for the due-soon obligation
    assert.match(res.body, /last policy: escalate/);
  } finally {
    server.close();
  }
});

test("AC-10: compliance panel uses pure derivation over ctx.events (no listObligationsUseCase import)", async () => {
  // Read the panel source and assert the import surface is projection-only.
  // This catches accidental coupling to the module's rule-set / policy adapters.
  const fs = await import("node:fs/promises");
  const src = await fs.readFile("apps/atlas/src/panels/compliance.ts", "utf8");
  assert.match(src, /from "@daedalus\/tax-compliance-guard"/);
  // Must NOT import listObligationsUseCase (which would re-read JSONL).
  assert.doesNotMatch(src, /listObligationsUseCase/);
  // Must NOT import RuleSetLoaderPort or PolicyStorePort.
  assert.doesNotMatch(src, /RuleSetLoaderPort/);
  assert.doesNotMatch(src, /PolicyStorePort/);
  // Must import deriveObligationStates directly.
  assert.match(src, /deriveObligationStates/);
});

test("AC-11: compliance panel renders empty state when tenant has no obligation events", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/compliance");
    assert.equal(res.status, 200);
    // Empty state text + zero totals (all metrics show "0")
    assert.match(res.body, /no obligations tracked/);
    assert.match(res.body, />Pending</);
    assert.match(res.body, />0</);
  } finally {
    server.close();
  }
});

test("AC-9 + tenant isolation: tenant-other's compliance never renders tenant-0's data", async () => {
  await clearAll();
  await seedTenant("tenant-0", complianceEvents());
  await seedTenant("tenant-other", [
    {
      eventId: "other-due", type: "ObligationDue", tenantId: "tenant-other",
      occurredAt: "2026-06-21T09:00:00.000Z", actor: "engine", causationId: null, correlationId: "c-other",
      payload: {
        obligationId: "obl-other-1",
        obligationHumanName: "Other-tenancy obligation",
        triggerEventId: "evt-o-1",
        triggerEventType: "InvoiceIssued",
        dueAt: "2027-01-01T00:00:00.000Z",
        ruleSetId: "other-rules",
        ruleSetVersion: "0.1.0",
        requiredHumanAction: "review",
      },
    },
  ]);

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const t0 = await get(server, "/t/tenant-0/compliance");
    assert.equal(t0.status, 200);
    assert.match(t0.body, /Monthly IVA filing/);
    assert.doesNotMatch(t0.body, /Other-tenancy obligation/);
    assert.doesNotMatch(t0.body, /other-rules/);

    const tother = await get(server, "/t/tenant-other/compliance");
    assert.equal(tother.status, 200);
    assert.match(tother.body, /Other-tenancy obligation/);
    assert.doesNotMatch(tother.body, /Monthly IVA filing/);
    assert.doesNotMatch(tother.body, /sii-iva-2026/);
  } finally {
    server.close();
  }
});
