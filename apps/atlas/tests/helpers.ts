// Test helpers — seed JSONL directly for integration tests.
// Each test gets its own temp directory so parallel test runs don't collide
// on `.data/tenants/`.

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setDataDir } from "../src/projections.ts";

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

let activeDir: string | null = null;

export async function useTempDataDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "atlas-test-"));
  activeDir = dir;
  setDataDir(dir);
  return dir;
}

export function activeDataDir(): string {
  if (activeDir === null) throw new Error("no active data dir; call useTempDataDir() first");
  return activeDir;
}

export async function seedTenant(tenantId: string, events: readonly SeedEvent[]): Promise<void> {
  const base = activeDataDir();
  const dir = join(base, "tenants", tenantId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "events.jsonl");
  const body = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(path, body, "utf8");
}

export async function clearTenant(tenantId: string): Promise<void> {
  const base = activeDataDir();
  await rm(join(base, "tenants", tenantId), { recursive: true, force: true });
}

export async function clearAll(): Promise<void> {
  const base = activeDataDir();
  await rm(join(base, "tenants"), { recursive: true, force: true });
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

// Seed workflow instances directly into the per-tenant JSONL file.
// Mirrors JsonlInstanceStoreAdapter's save format: one JSON per line.
// Path matches the adapter's resolved file (no `.data/` prefix — both stores
// treat `baseDir` as the data root, so `getDataDir()` IS the `.data/` root).
export type SeedInstance = {
  id: string;
  workflowName: string;
  workflowVersion: string;
  tenantId: string;
  currentState: string;
  status: "active" | "waiting_human" | "completed" | "compensated";
  firedTransitionIds: string[];
  pendingTransitionId: string | null;
  history: Array<{
    transitionId: string;
    fromState: string;
    toState: string;
    firedAt: string;
    triggerEventId: string;
  }>;
  startedAt: string;
  updatedAt: string;
  lastSeenEventId: string | null;
};

export async function seedInstances(tenantId: string, instances: readonly SeedInstance[]): Promise<void> {
  const base = activeDataDir();
  const dir = join(base, "tenants", tenantId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "workflow-instances.jsonl");
  const body = instances.map((i) => JSON.stringify(i)).join("\n") + "\n";
  await writeFile(path, body, "utf8");
}