// Test helpers: deterministic deps (fixed ids/clock) over the REAL adapters in a temp dir.
// Integration-level: composes core + proposal-generation + opportunity-discovery + revenue-visibility + jsonl-event-store.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProposalDeps } from "@daedalus/proposal-generation";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import type { OpportunityDiscoveryDeps } from "@daedalus/opportunity-discovery";
import { JsonOpportunityStoreAdapter } from "@daedalus/opportunity-discovery/adapters";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";

export type TestDeps = ProposalDeps & OpportunityDiscoveryDeps & RevenueDeps;

export function makeTestDeps(): { deps: TestDeps; baseDir: string } {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-"));
  let counter = 0;
  const deps: TestDeps = {
    eventStore: new JsonlEventStoreAdapter(baseDir),
    draftStore: new JsonFileDraftStoreAdapter(baseDir),
    opportunityStore: new JsonOpportunityStoreAdapter(baseDir),
    thresholds: new TenantConfigThresholdsAdapter(),
    newId: () => `id-${++counter}`,
    now: () => "2026-06-13T00:00:00.000Z",
    actor: "test",
  };
  return { deps, baseDir };
}