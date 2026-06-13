// Test helpers: deterministic deps (fixed ids/clock) over the REAL adapters in a temp dir.
// Integration-level: composes core + proposal-generation + jsonl-event-store.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProposalDeps } from "@daedalus/proposal-generation";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";

export function makeTestDeps(): { deps: ProposalDeps; baseDir: string } {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-"));
  let counter = 0;
  const deps: ProposalDeps = {
    eventStore: new JsonlEventStoreAdapter(baseDir),
    draftStore: new JsonFileDraftStoreAdapter(baseDir),
    newId: () => `id-${++counter}`,
    now: () => "2026-06-13T00:00:00.000Z",
    actor: "test",
  };
  return { deps, baseDir };
}
