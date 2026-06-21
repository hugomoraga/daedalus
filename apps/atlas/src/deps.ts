// ATLAS deps builder. Composition root only.
// Wires the same JsonlEventStoreAdapter as the CLI; revenue-visibility adds
// the AlertThresholdsPort (TenantConfigThresholdsAdapter).
//
// We do NOT import the proposal-generation or opportunity-discovery adapters
// here — ATLAS does not invoke those use cases; it only reads their projections.

import { randomUUID } from "node:crypto";
import type { CoreDeps } from "@daedalus/core";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
import { getDataDir } from "./projections.ts";

export function buildAtlasDeps(): RevenueDeps {
  const eventStore = new JsonlEventStoreAdapter(getDataDir());
  return {
    eventStore,
    thresholds: new TenantConfigThresholdsAdapter(),
    newId: () => randomUUID(),
    now: () => new Date().toISOString(),
    actor: "atlas",
  };
}

export type AtlasDeps = RevenueDeps & CoreDeps;