// Opportunity Discovery — JSON file adapter for the OpportunityStorePort.
// Stores each opportunity as a JSON file at <baseDir>/tenants/<tenantId>/opportunities/<id>.json.
// Same pattern as JsonFileDraftStoreAdapter (per Technical Principles: mutable work-area).
//
// Security: tenantId and opportunityId are validated as single path segments.
// Defense in depth (see jsonl-event-store for rationale).

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Opportunity } from "../domain/opportunity.ts";
import type { OpportunityStorePort } from "../application/ports/opportunity-store.ts";

function assertSafeSegment(value: string, name: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  if (isAbsolute(value) || value.includes("/") || value.includes("\\") || value.includes("\0") || value === "." || value === "..") {
    throw new Error(`${name} must be a single path segment (no separators, no '..')`);
  }
}

export class JsonOpportunityStoreAdapter implements OpportunityStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  #file(tenantId: string, opportunityId: string): string {
    assertSafeSegment(tenantId, "tenantId");
    assertSafeSegment(opportunityId, "opportunityId");
    const file = join(this.#baseDir, "tenants", tenantId, "opportunities", `${opportunityId}.json`);
    if (!resolve(file).startsWith(resolve(this.#baseDir) + "/") && resolve(file) !== resolve(this.#baseDir)) {
      throw new Error(`path escapes baseDir: ${file}`);
    }
    return file;
  }

  async load(tenantId: string, opportunityId: string): Promise<Opportunity | null> {
    const file = this.#file(tenantId, opportunityId);
    if (!existsSync(file)) return null;
    const content = await readFile(file, "utf8");
    return JSON.parse(content) as Opportunity;
  }

  async save(opportunity: Opportunity): Promise<void> {
    const file = this.#file(opportunity.tenantId, opportunity.id);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(opportunity, null, 2), "utf8");
  }
}