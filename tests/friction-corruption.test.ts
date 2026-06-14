// Friction test: what happens when the JSONL event log is corrupted?

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";

const T = "tenant-0";

function fresh(): { store: JsonlEventStoreAdapter; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "daedalus-corrupt-"));
  const store = new JsonlEventStoreAdapter(dir);
  const file = join(dir, "tenants", T, "events.jsonl");
  // Create parent dir so writeFileSync doesn't ENOENT (the store would create it on
  // append, but this test writes directly to the file).
  mkdirSync(dirname(file), { recursive: true });
  return { store, file };
}

test("corruption/garbage line: what does readStream do?", async () => {
  const { store, file } = fresh();
  // Write a valid event
  const ev = {
    eventId: "id-1",
    type: "LeadCreated",
    tenantId: T,
    occurredAt: "2026-01-01T00:00:00.000Z",
    actor: "x",
    causationId: null,
    correlationId: "corr-1",
    payload: { leadId: "id-1", customer: "X" },
  };
  writeFileSync(file, JSON.stringify(ev) + "\n", "utf8");
  // Append a garbage line
  appendFileSync(file, "{this is not valid json}\n", "utf8");
  // Append another valid event
  const ev2 = { ...ev, eventId: "id-2", type: "LeadQualified" };
  appendFileSync(file, JSON.stringify(ev2) + "\n", "utf8");

  let crashed = false;
  let events: any[] = [];
  try {
    events = await store.readStream(T);
  } catch {
    crashed = true;
  }
  console.log(`[corrupt-line]  crashed=${crashed}  count=${events.length}`);
  // Documentary: this tells us whether one bad line kills the whole stream
  assert.ok(true);
});

test("corruption/empty file: readStream returns empty array, not crash", async () => {
  const { store } = fresh();
  const events = await store.readStream(T);
  assert.deepEqual(events, []);
});

test("corruption/append to non-existent dir: should create it, not crash", async () => {
  const dir = mkdtempSync(join(tmpdir(), "daedalus-newdir-"));
  const store = new JsonlEventStoreAdapter(dir);
  const ev = {
    eventId: "id-1",
    type: "LeadCreated",
    tenantId: "fresh-tenant",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actor: "x",
    causationId: null,
    correlationId: "corr-1",
    payload: { leadId: "id-1", customer: "X" },
  };
  await store.append(ev as any);
  const events = await store.readStream("fresh-tenant");
  assert.equal(events.length, 1);
});

test("corruption/tenant id with path-traversal characters: rejected by the store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "daedalus-trav-"));
  const store = new JsonlEventStoreAdapter(dir);
  const evil = "../../../etc/passwd";
  const ev = {
    eventId: "id-1",
    type: "LeadCreated",
    tenantId: evil,
    occurredAt: "2026-01-01T00:00:00.000Z",
    actor: "x",
    causationId: null,
    correlationId: "corr-1",
    payload: { leadId: "id-1", customer: "X" },
  };
  // Should reject path-traversal at the adapter boundary, not write outside baseDir.
  await assert.rejects(
    () => store.append(ev as any),
    /segment|escapes|tenants/,
  );
  // And readStream on the same evil id should also fail.
  await assert.rejects(
    () => store.readStream(evil),
    /segment|escapes|tenants/,
  );
});

test("corruption/absolute tenant id path: rejected by the store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "daedalus-abs-"));
  const store = new JsonlEventStoreAdapter(dir);
  const ev = {
    eventId: "id-1",
    type: "LeadCreated",
    tenantId: "/etc/passwd",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actor: "x",
    causationId: null,
    correlationId: "corr-1",
    payload: { leadId: "id-1", customer: "X" },
  };
  await assert.rejects(() => store.append(ev as any), /segment|escapes|tenants/);
});

test("corruption/segment with slash: rejected by the store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "daedalus-slash-"));
  const store = new JsonlEventStoreAdapter(dir);
  const ev = {
    eventId: "id-1",
    type: "LeadCreated",
    tenantId: "tenant/../other",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actor: "x",
    causationId: null,
    correlationId: "corr-1",
    payload: { leadId: "id-1", customer: "X" },
  };
  await assert.rejects(() => store.append(ev as any), /segment|escapes|tenants/);
});
