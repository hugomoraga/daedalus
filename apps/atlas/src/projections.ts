// Projections facade — reads the tenant JSONL and exposes the projections
// ATLAS consumes. Server-side only: the browser never receives raw JSONL.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DomainEvent } from "@daedalus/core";

let dataDir = ".data";

export function setDataDir(dir: string): void {
  dataDir = dir;
}

export function getDataDir(): string {
  return dataDir;
}

export async function readTenantEvents(tenantId: string): Promise<readonly DomainEvent[]> {
  const path = join(dataDir, "tenants", tenantId, "events.jsonl");
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf8");
  const events: DomainEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      events.push(JSON.parse(trimmed) as DomainEvent);
    } catch {
      // Skip malformed lines — they would have failed integrity elsewhere.
    }
  }
  return events;
}

export type WelcomeSnapshot = {
  eventCount: number;
  lastEventAt: string | null;
  lastEventType: string | null;
};

export function computeWelcome(events: readonly DomainEvent[]): WelcomeSnapshot {
  if (events.length === 0) {
    return { eventCount: 0, lastEventAt: null, lastEventType: null };
  }
  const last = events[events.length - 1];
  return {
    eventCount: events.length,
    lastEventAt: last.occurredAt,
    lastEventType: last.type,
  };
}