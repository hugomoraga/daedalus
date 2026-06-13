// Driven adapter: the mutable draft work-area, one JSON file per draft.
// Implements DraftStorePort. NOT the event log — drafts are a read-model (Spec 002 §6).
// Module-specific infra (only proposal-generation uses drafts), so it lives with its module.
//   <baseDir>/tenants/<tenantId>/drafts/<draftId>.json

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ProposalDraft } from "../domain/proposal-draft.ts";
import type { DraftStorePort } from "../application/ports/draft-store.ts";

export class JsonFileDraftStoreAdapter implements DraftStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  #file(tenantId: string, draftId: string): string {
    return join(this.#baseDir, "tenants", tenantId, "drafts", `${draftId}.json`);
  }

  async load(tenantId: string, draftId: string): Promise<ProposalDraft | null> {
    const file = this.#file(tenantId, draftId);
    if (!existsSync(file)) return null;
    const content = await readFile(file, "utf8");
    return JSON.parse(content) as ProposalDraft;
  }

  async save(draft: ProposalDraft): Promise<void> {
    const file = this.#file(draft.tenantId, draft.id);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(draft, null, 2), "utf8");
  }
}
