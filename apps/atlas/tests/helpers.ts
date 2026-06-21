// Test helpers — seed JSONL directly for integration tests.

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

export const DATA_DIR = ".data";

export type SeedEvent = {
  eventId: string;
  type: string;
  tenantId: string;
  occurredAt: string;
  actor: string;
  causationId: string | null;
  correlationId: string;
  payload: Record<string, unknown>;
};

export async function seedTenant(tenantId: string, events: readonly SeedEvent[]): Promise<void> {
  const dir = join(DATA_DIR, "tenants", tenantId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "events.jsonl");
  const body = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(path, body, "utf8");
}

export async function clearTenant(tenantId: string): Promise<void> {
  await rm(join(DATA_DIR, "tenants", tenantId), { recursive: true, force: true });
}

export async function clearAll(): Promise<void> {
  await rm(join(DATA_DIR, "tenants"), { recursive: true, force: true });
}

export function makeFlow(tenantId: string, correlationId: string, types: readonly string[]): SeedEvent[] {
  return types.map((type, i) => ({
    eventId: `${correlationId}-${i.toString().padStart(4, "0")}`,
    type,
    tenantId,
    occurredAt: new Date(Date.UTC(2026, 5, 20, 12, 0, i)).toISOString(),
    actor: "cli",
    causationId: i === 0 ? null : `${correlationId}-${(i - 1).toString().padStart(4, "0")}`,
    correlationId,
    payload: { i },
  }));
}