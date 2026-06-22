// Test helpers: deterministic deps (fixed ids/clock) over the REAL adapters in a temp dir.
// Integration-level: composes core + proposal-generation + opportunity-discovery + revenue-visibility + jsonl-event-store + workflow-engine.

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProposalDeps } from "@daedalus/proposal-generation";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import type { OpportunityDiscoveryDeps } from "@daedalus/opportunity-discovery";
import { JsonOpportunityStoreAdapter } from "@daedalus/opportunity-discovery/adapters";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import {
  createLeadUseCase,
  qualifyLeadUseCase,
  type CoreDeps,
} from "@daedalus/core";
import {
  startDraftUseCase,
  addLineItemUseCase,
  finalizeDraftUseCase,
} from "@daedalus/proposal-generation";
import type { EngineDeps } from "@daedalus/workflow-engine";
import { JsonlInstanceStoreAdapter, JsonlWorkflowStoreAdapter } from "@daedalus/workflow-engine/adapters";
import { coreUseCases, noOpPolicy, runEngine, type PolicyDecisionPort } from "@daedalus/workflow-engine";

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

// Drive a proposal all the way to ProposalGenerated and return the proposalId.
// Used by core-value-chain integration tests as a deterministic setup shortcut.
export async function finalizeAProposal(
  deps: TestDeps,
  tenantId = "tenant-0",
  customer = "ACME (mock)",
): Promise<string> {
  const { leadId } = await createLeadUseCase(deps, { tenantId, customer });
  await qualifyLeadUseCase(deps, { tenantId, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId, leadId, template: "standard" });
  await addLineItemUseCase(deps, { tenantId, draftId, label: "Discovery", amount: 1200 });
  await addLineItemUseCase(deps, { tenantId, draftId, label: "Build", amount: 4800 });
  const { proposalId } = await finalizeDraftUseCase(deps, { tenantId, draftId, currency: "CLP" });
  return proposalId;
}

// Workflow-engine specific: sets up a temp dir with the lead-to-payment
// workflow artifact + an empty tenant override, wires EngineDeps with the
// given policy.
export type EngineTestHandle = {
  deps: EngineDeps;
  baseDir: string;
  tenantId: string;
  append: CoreDeps["eventStore"]["append"];
  readStream: CoreDeps["eventStore"]["readStream"];
  // Wipe the engine cursor (test helper — simulates engine restart re-reading from start).
  resetCursor: () => Promise<void>;
  // Run the engine loop for `ms` milliseconds, then stop.
  runFor: (ms: number) => Promise<void>;
};

export function makeEngineDeps(
  opts: { policy?: PolicyDecisionPort; tenantId?: string } = {},
): EngineTestHandle {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-engine-"));
  const tenantId = opts.tenantId ?? "tenant-0";
  mkdirSync(join(baseDir, "blueprints", "workflows"), { recursive: true });
  mkdirSync(join(baseDir, "config", "tenants", tenantId), { recursive: true });
  copyFileSync(
    "blueprints/workflows/lead-to-payment.v0.1.0.json",
    join(baseDir, "blueprints", "workflows", "lead-to-payment.v0.1.0.json"),
  );
  writeFileSync(join(baseDir, "config", "tenants", tenantId, "workflows.json"), "[]\n");
  let counter = 0;
  const eventStore = new JsonlEventStoreAdapter(baseDir);
  const core: CoreDeps = {
    eventStore,
    newId: () => `id-${++counter}`,
    now: () => "2026-06-13T00:00:00.000Z",
    actor: "test",
  };
  const deps: EngineDeps = {
    ...core,
    policy: opts.policy ?? noOpPolicy,
    workflowStore: new JsonlWorkflowStoreAdapter(baseDir),
    instanceStore: new JsonlInstanceStoreAdapter(baseDir),
    useCases: coreUseCases(core),
  };
  const append = eventStore.append.bind(eventStore);
  const readStream = eventStore.readStream.bind(eventStore);
  const resetCursor = async (): Promise<void> => {
    await deps.instanceStore.setCursor(tenantId, "");
  };
  // Run the engine loop and wait until the event stream stops growing
  // (with a hard ceiling of `maxMs` for the whole operation). Avoids the
  // race between the engine's first poll tick and a fixed `setTimeout`.
  // Polling cadence of 25ms keeps wall-clock cost low.
  const runFor = async (maxMs: number): Promise<void> => {
    const handle = runEngine(deps, tenantId, { pollMs: 10 });
    const start = Date.now();
    let lastSize = -1;
    let stableSince = 0;
    while (Date.now() - start < maxMs) {
      await new Promise((r) => setTimeout(r, 25));
      const size = (await readStream(tenantId)).length;
      if (size === lastSize) {
        if (stableSince === 0) stableSince = Date.now();
        // Stream is stable for 150ms — engine is done.
        if (Date.now() - stableSince > 150) break;
      } else {
        lastSize = size;
        stableSince = 0;
      }
    }
    handle.stop();
    await new Promise((r) => setTimeout(r, 30));
  };
  return { deps, baseDir, tenantId, append, readStream, resetCursor, runFor };
}