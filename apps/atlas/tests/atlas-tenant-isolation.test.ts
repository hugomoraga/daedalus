// Tenant isolation — Spec 007 AC-2.
// Two seeded tenants must never leak into each other's responses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import { seedTenant, clearAll, makeFlow } from "./helpers.ts";

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

test("atlas AC-2: two tenants — events panel renders only its own stream", async () => {
  await clearAll();
  const corrA = "00000000-0000-0000-0000-000000000aaa";
  const corrB = "00000000-0000-0000-0000-000000000bbb";
  await seedTenant("tenant-0", makeFlow("tenant-0", corrA, [
    "LeadCreated",
    "LeadQualified",
    "ProposalGenerated",
    "ProposalApproved",
  ]));
  await seedTenant("tenant-other", makeFlow("tenant-other", corrB, [
    "LeadCreated",
    "LeadQualified",
    "ProposalRejected",
  ]));

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const a = await get(server, "/t/tenant-0/events");
    assert.equal(a.status, 200, `unexpected status ${a.status}, body: ${a.body.slice(0, 300)}`);
    assert.match(a.body, /ProposalApproved/);
    assert.doesNotMatch(a.body, /ProposalRejected/, "tenant-other data leaked into tenant-0 view");

    const b = await get(server, "/t/tenant-other/events");
    assert.equal(b.status, 200, `unexpected status ${b.status}, body: ${b.body.slice(0, 300)}`);
    assert.match(b.body, /ProposalRejected/);
    assert.doesNotMatch(b.body, /ProposalApproved/, "tenant-0 data leaked into tenant-other view");
  } finally {
    server.close();
    await clearAll();
  }
});

test("atlas AC-2: activity panel shows counts per its own tenant only", async () => {
  await clearAll();
  await seedTenant("tenant-0", makeFlow("tenant-0", "corr-a", [
    "LeadCreated",
    "LeadQualified",
    "ProposalGenerated",
  ]));
  await seedTenant("tenant-other", makeFlow("tenant-other", "corr-b", [
    "LeadCreated",
    "LeadDiscarded",
    "LeadDiscarded",
  ]));

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const a = await get(server, "/t/tenant-0/activity");
    assert.equal(a.status, 200);
    assert.match(a.body, /3 event/);
    assert.doesNotMatch(a.body, /LeadDiscarded/, "tenant-other type leaked into tenant-0 activity");

    const b = await get(server, "/t/tenant-other/activity");
    assert.equal(b.status, 200);
    assert.match(b.body, /3 event/);
    assert.match(b.body, /LeadDiscarded/);
    assert.doesNotMatch(b.body, /ProposalGenerated/, "tenant-0 type leaked into tenant-other activity");
  } finally {
    server.close();
    await clearAll();
  }
});

test("atlas AC-2: health panel shows its own SHA-256 (different per tenant)", async () => {
  await clearAll();
  await seedTenant("tenant-0", makeFlow("tenant-0", "corr-a", ["LeadCreated", "LeadQualified"]));
  await seedTenant("tenant-other", makeFlow("tenant-other", "corr-b", ["LeadCreated", "LeadQualified", "LeadDiscarded"]));

  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const a = await get(server, "/t/tenant-0/health");
    const b = await get(server, "/t/tenant-other/health");
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const hashA = a.body.match(/[0-9a-f]{12}…/)?.[0];
    const hashB = b.body.match(/[0-9a-f]{12}…/)?.[0];
    assert.ok(hashA !== undefined && hashB !== undefined, "expected a hash in both responses");
    assert.notEqual(hashA, hashB, "two tenants with different streams produced the same hash");
  } finally {
    server.close();
    await clearAll();
  }
});