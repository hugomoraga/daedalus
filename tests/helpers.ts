// Test helpers: deterministic deps (fixed ids/clock) over the REAL adapters in a temp dir.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Deps } from "../src/application/shared/deps.ts";
import { JsonlEventStoreAdapter } from "../src/adapters/persistence/jsonl-event-store.ts";
import { JsonFileDraftStoreAdapter } from "../src/adapters/persistence/json-draft-store.ts";

export function makeTestDeps(): { deps: Deps; baseDir: string } {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-"));
  let counter = 0;
  const deps: Deps = {
    eventStore: new JsonlEventStoreAdapter(baseDir),
    draftStore: new JsonFileDraftStoreAdapter(baseDir),
    newId: () => `id-${++counter}`,
    now: () => "2026-06-13T00:00:00.000Z",
    actor: "test",
  };
  return { deps, baseDir };
}
