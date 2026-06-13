// EventStorePort / JsonlEventStoreAdapter — append-only immutability + tenant isolation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import type { DomainEvent } from "@daedalus/core";

function evt(tenantId: string, type: string, n: number): DomainEvent {
  return {
    id: `e-${n}`,
    type,
    tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    cause: null,
    payload: { n },
  };
}

test("append then readStream returns events in order", async () => {
  const store = new JsonlEventStoreAdapter(mkdtempSync(join(tmpdir(), "daedalus-")));
  await store.append(evt("t0", "A", 1));
  await store.append(evt("t0", "B", 2));
  const events = await store.readStream("t0");
  assert.deepEqual(events.map((e) => e.type), ["A", "B"]);
});

test("appending never mutates prior lines (append-only immutability)", async () => {
  const store = new JsonlEventStoreAdapter(mkdtempSync(join(tmpdir(), "daedalus-")));
  await store.append(evt("t0", "A", 1));
  const first = await store.readStream("t0");
  await store.append(evt("t0", "B", 2));
  const second = await store.readStream("t0");
  assert.deepEqual(second[0], first[0]); // the first event is byte-for-byte unchanged
  assert.equal(second.length, 2);
});

test("tenant isolation: a tenant only sees its own events (AC-9)", async () => {
  const store = new JsonlEventStoreAdapter(mkdtempSync(join(tmpdir(), "daedalus-")));
  await store.append(evt("tenant-a", "A", 1));
  await store.append(evt("tenant-b", "B", 1));
  const a = await store.readStream("tenant-a");
  const b = await store.readStream("tenant-b");
  assert.deepEqual(a.map((e) => e.type), ["A"]);
  assert.deepEqual(b.map((e) => e.type), ["B"]);
});

test("unknown tenant returns an empty stream", async () => {
  const store = new JsonlEventStoreAdapter(mkdtempSync(join(tmpdir(), "daedalus-")));
  assert.deepEqual(await store.readStream("nobody"), []);
});
