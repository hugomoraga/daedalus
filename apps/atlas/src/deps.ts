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
// Path asymmetry note: the event store treats `baseDir` as the data dir
// directly (e.g. baseDir=".data" → ".data/tenants/<id>/events.jsonl"); the
// instance store adapter appends `.data/` internally (see Spec 011 §4.1 /
// jsonl-instance-store.ts). To read instances written by the workflow engine
// CLI (which uses `JsonlInstanceStoreAdapter(process.cwd())`), ATLAS must
// also pass `process.cwd()` so the resolved path is `<cwd>/.data/tenants/<id>/...`.

import { randomUUID } from "node:crypto";
import type { CoreDeps } from "@daedalus/core";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import type { InstanceStorePort } from "@daedalus/workflow-engine";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
import { JsonlInstanceStoreAdapter } from "@daedalus/workflow-engine/adapters";
import { getDataDir } from "./projections.ts";

export function buildAtlasDeps(): AtlasDeps {
  const eventStore = new JsonlEventStoreAdapter(getDataDir());
  const instanceStore = new JsonlInstanceStoreAdapter(process.cwd());
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
