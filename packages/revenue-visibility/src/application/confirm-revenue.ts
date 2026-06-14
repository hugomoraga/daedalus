// Revenue Visibility — manual confirm-revenue use case (T-07).
// Idempotent: if already confirmed or received, the aggregate returns no events.

import { appendIntents, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { confirmEstimate } from "../domain/estimate.ts";
import { projectEstimate } from "./projections.ts";

export type ConfirmRevenueCommand = {
  tenantId: string;
  estimateId: string;
};

export async function confirmRevenueUseCase(
  deps: RevenueDeps,
  cmd: ConfirmRevenueCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const estimate = projectEstimate(events, cmd.estimateId);
  if (estimate === null) {
    throw new Error(`Estimate ${cmd.estimateId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = confirmEstimate(estimate);
  if (intents.length === 0) return { changed: false };
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
  return { changed: true };
}