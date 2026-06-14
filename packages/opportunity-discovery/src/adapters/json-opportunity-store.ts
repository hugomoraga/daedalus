// Opportunity Discovery — JSON file adapter for the OpportunityStorePort.
// Stores each opportunity as a JSON file at <baseDir>/tenants/<tenantId>/opportunities/<id>.json.
// Same pattern as JsonFileDraftStoreAdapter (per Technical Principles: mutable work-area).

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Opportunity } from "../domain/opportunity.ts";
import type { OpportunityStorePort } from "../application/ports/opportunity-store.ts";

export class JsonOpportunityStoreAdapter implements OpportunityStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  #file(tenantId: string, opportunityId: string): string {
    return join(this.#baseDir, "tenants", tenantId, "opportunities", `${opportunityId}.json`);
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