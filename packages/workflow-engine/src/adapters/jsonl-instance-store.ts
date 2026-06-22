// Driven adapter: persists workflow instances + the engine's polling cursor.
//   <baseDir>/tenants/<tenant>/workflow-instances.jsonl
//   <baseDir>/tenants/<tenant>/.engine-cursor
// Gitignored. One file per tenant. Append-only on save (immutability is not
// required for instance state — instances evolve — but a single linear write
// per save keeps the format simple and replayable).
//
// `baseDir` is the data root (e.g. `.data` in production, a temp dir in tests).
// Callers that previously wrote via `<cwd>/.data/tenants/...` (when the adapter
// appended `.data/` internally) must now pass `join(process.cwd(), ".data")` —
// this convention matches `JsonlEventStoreAdapter` so the two stores agree on
// the data root.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Instance } from "../domain/instance.ts";
import type { InstanceQueryOptions, InstanceStatusFilter } from "../domain/instance-query.ts";
import type { InstanceStorePort } from "../application/ports/instance-store.ts";
import {
  clampLimit,
  filterByStatus,
  filterByWorkflow,
  filterSince,
  sortByStartedAtDesc,
} from "../application/projections/_helpers.ts";

function assertSafeSegment(value: string, name: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  if (
    isAbsolute(value) ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(`${name} must be a single path segment`);
  }
}

export class JsonlInstanceStoreAdapter implements InstanceStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  #file(tenantId: string): string {
    assertSafeSegment(tenantId, "tenantId");
    const file = join(this.#baseDir, "tenants", tenantId, "workflow-instances.jsonl");
    const resolved = resolve(file);
    const baseResolved = resolve(this.#baseDir);
    if (!resolved.startsWith(baseResolved + "/") && resolved !== baseResolved) {
      throw new Error(`instance file escapes baseDir: ${file}`);
    }
    return file;
  }

  #cursorFile(tenantId: string): string {
    assertSafeSegment(tenantId, "tenantId");
    return join(this.#baseDir, "tenants", tenantId, ".engine-cursor");
  }

  async findByCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<Instance[]> {
    const file = this.#file(tenantId);
    if (!existsSync(file)) return [];
    const content = await readFile(file, "utf8");
    const latest = new Map<string, Instance>();
    for (const line of content.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        const inst = JSON.parse(line) as Instance;
        if (inst.id === correlationId) latest.set(inst.id, inst);
      } catch {
        // skip malformed lines (parallel to the event store's resilience)
      }
    }
    return Array.from(latest.values());
  }

  // NEW in Spec 011 v1.0 — additive read method for the read-side projections
  // (Active Processes, Queue Status, Workflow Metrics). Streams the per-tenant
  // file, keeps the latest snapshot per id, applies filters in memory, sorts
  // by `startedAt` desc, clamps `limit` to 1000. Returns `[]` on missing file.
  async list(
    tenantId: string,
    options?: InstanceQueryOptions,
  ): Promise<Instance[]> {
    const file = this.#file(tenantId);
    if (!existsSync(file)) return [];
    const content = await readFile(file, "utf8");
    const latest = new Map<string, Instance>();
    for (const line of content.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        const inst = JSON.parse(line) as Instance;
        latest.set(inst.id, inst); // overwrite = latest snapshot wins
      } catch {
        // skip malformed lines
      }
    }
    const all = Array.from(latest.values());
    // Default status filter: live instances only (Spec 011 §3.1 / AC-2).
    const statusFilter: InstanceStatusFilter[] = options?.status ?? ["active", "waiting_human"];
    const filtered = sortByStartedAtDesc(
      filterByWorkflow(
        filterSince(filterByStatus(all, statusFilter), options?.since),
        options,
      ),
    );
    return filtered.slice(0, clampLimit(options));
  }

  async save(tenantId: string, instance: Instance): Promise<void> {
    const file = this.#file(tenantId);
    await mkdir(dirname(file), { recursive: true });
    // Append-only: one JSON per line. The store keeps the latest snapshot per
    // id, so reads above pick up the most recent state.
    await writeFile(file, JSON.stringify(instance) + "\n", { flag: "a", encoding: "utf8" });
  }

  async getCursor(tenantId: string): Promise<string | null> {
    const file = this.#cursorFile(tenantId);
    if (!existsSync(file)) return null;
    const content = (await readFile(file, "utf8")).trim();
    if (content.length === 0) return null;
    try {
      const parsed = JSON.parse(content) as { lastSeenAt?: unknown };
      return typeof parsed.lastSeenAt === "string" ? parsed.lastSeenAt : null;
    } catch {
      return null;
    }
  }

  async setCursor(tenantId: string, occurredAt: string): Promise<void> {
    const file = this.#cursorFile(tenantId);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ lastSeenAt: occurredAt }), "utf8");
  }
}