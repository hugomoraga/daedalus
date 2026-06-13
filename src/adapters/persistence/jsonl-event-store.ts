// Driven adapter: append-only JSONL event store, one file per tenant.
// Implements EventStorePort. The only place that knows persistence is JSONL.
//   .data/tenants/<tenantId>/events.jsonl

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DomainEvent } from "../../domain/core/event.ts";
import type { EventStorePort } from "../../application/ports/event-store.ts";

export class JsonlEventStoreAdapter implements EventStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  #file(tenantId: string): string {
    return join(this.#baseDir, "tenants", tenantId, "events.jsonl");
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
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as DomainEvent);
  }
}
