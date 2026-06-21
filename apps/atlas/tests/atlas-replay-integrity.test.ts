// Replay integrity — Spec 007 AC-3.
// The System Health panel's SHA-256 must be deterministic for the same input
// and must change when the input changes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { DomainEvent } from "@daedalus/core";
import { seedTenant, clearAll, makeFlow } from "./helpers.ts";

function hashEvents(events: readonly DomainEvent[]): string {
  const canonical = events
    .slice()
    .sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0))
    .map((e) => JSON.stringify(e))
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

test("atlas AC-3: same events → same hash (determinism)", () => {
  const events = makeFlow("tenant-0", "corr-x", ["LeadCreated", "LeadQualified", "ProposalGenerated"]);
  const h1 = hashEvents(events);
  const h2 = hashEvents(events);
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test("atlas AC-3: appending an event changes the hash (drift detection)", () => {
  const before = makeFlow("tenant-0", "corr-y", ["LeadCreated", "LeadQualified"]);
  const after = [...before, ...makeFlow("tenant-0", "corr-y", ["ProposalGenerated"])];
  assert.notEqual(hashEvents(before), hashEvents(after));
});

test("atlas AC-3: seed → JSONL → readTenantEvents roundtrip preserves hash", async () => {
  await clearAll();
  const original = makeFlow("tenant-0", "corr-z", [
    "LeadCreated",
    "LeadQualified",
    "ProposalGenerated",
    "ProposalSubmitted",
    "ProposalApproved",
  ]);
  await seedTenant("tenant-0", original);

  const { readTenantEvents } = await import("../src/projections.ts");
  const read = await readTenantEvents("tenant-0");
  assert.equal(read.length, original.length);
  const hashOriginal = hashEvents(original as unknown as readonly DomainEvent[]);
  const hashRead = hashEvents(read);
  assert.equal(hashOriginal, hashRead, "roundtrip changed the canonical form");
  await clearAll();
});