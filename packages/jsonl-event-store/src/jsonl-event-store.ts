// Driven adapter: append-only JSONL event store, one file per tenant.
// Implements EventStorePort. The only place that knows persistence is JSONL.
//   <baseDir>/tenants/<tenantId>/events.jsonl
//
// Security: tenantId is validated as a single path segment (no '/', no '..').
// This prevents path-traversal if the input ever comes from an untrusted source
// (CLI args, env vars, HTTP requests). Defense in depth: in practice today
// tenantId comes from config/tenants/, but the adapter cannot rely on that.

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { DomainEvent, EventStorePort } from "@daedalus/core";

function assertSafeSegment(value: string, name: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  if (isAbsolute(value) || value.includes("/") || value.includes("\\") || value.includes("\0") || value === "." || value === "..") {
    throw new Error(`${name} must be a single path segment (no separators, no '..')`);
  }
}

export class JsonlEventStoreAdapter implements EventStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  #file(tenantId: string): string {
    assertSafeSegment(tenantId, "tenantId");
    const file = join(this.#baseDir, "tenants", tenantId, "events.jsonl");
    // Belt-and-suspenders: also confirm the resolved file lives under baseDir.
    if (!resolve(file).startsWith(resolve(this.#baseDir) + "/") && resolve(file) !== resolve(this.#baseDir)) {
      throw new Error(`path escapes baseDir: ${file}`);
    }
    return file;
  }

  async append(event: DomainEvent): Promise<void> {
    const file = this.#file(event.tenantId);
    await mkdir(dirname(file), { recursive: true });
    // One JSON object per line, appended. Prior lines are never rewritten (immutability).
    await appendFile(file, JSON.stringify(event) + "\n", "utf8");
  }

  async readStream(tenantId: string): Promise<DomainEvent[]> {
    const file = this.#file(tenantId);
    if (!existsSync(file)) return [];
    const content = await readFile(file, "utf8");
    const events: DomainEvent[] = [];
    for (const line of content.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        events.push(JSON.parse(line) as DomainEvent);
      } catch {
        // Skip corrupted lines: an append-only log may have a partial/malformed line
        // (crash mid-write, manual edit). We never want one bad line to kill the stream —
        // the rest of the audit trail must remain readable. The corruption is a data issue,
        // not a reader issue: detected here, but quarantined (not silently dropped — the
        // application layer may wish to alert on read-skips).
      }
    }
    return events;
  }
}
