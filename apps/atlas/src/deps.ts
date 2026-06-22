// ATLAS deps builder. Composition root only.
// Wires the same JsonlEventStoreAdapter as the CLI; revenue-visibility adds
// the AlertThresholdsPort (TenantConfigThresholdsAdapter). The workflow-engine
// instance store is added for the Phase 2 panels (T-20..T-22 in Spec 007
// tasks.md) — backed by the read-side projections from @daedalus/workflow-engine
// (Spec 011).
//
// We do NOT import the proposal-generation or opportunity-discovery adapters
// here — ATLAS does not invoke those use cases; it only reads their projections.
//
// Path convention: both JSONL stores treat `baseDir` as the data root
// (e.g. baseDir=".data" → ".data/tenants/<id>/..."). The CLI sets DATA_DIR=".data"
// explicitly; tests override `getDataDir()` via `setDataDir(tempDir)`. The
// convention is unified across event store, instance store, and the test
// helpers (no `.data/` prefix anywhere except as the value of `getDataDir()`).

import { randomUUID } from "node:crypto";
import type { CoreDeps } from "@daedalus/core";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import type { InstanceStorePort } from "@daedalus/workflow-engine";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
import { JsonlInstanceStoreAdapter } from "@daedalus/workflow-engine/adapters";
import { getDataDir } from "./projections.ts";

export function buildAtlasDeps(): AtlasDeps {
  const dataDir = getDataDir();
  const eventStore = new JsonlEventStoreAdapter(dataDir);
  const instanceStore = new JsonlInstanceStoreAdapter(dataDir);
  return {
    eventStore,
    instanceStore,
    thresholds: new TenantConfigThresholdsAdapter(),
    newId: () => randomUUID(),
    now: () => new Date().toISOString(),
    actor: "atlas",
  };
}

export type AtlasDeps = RevenueDeps & CoreDeps & {
  instanceStore: InstanceStorePort;
};
