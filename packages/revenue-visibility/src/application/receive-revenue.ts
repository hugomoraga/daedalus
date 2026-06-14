// Revenue Visibility — manual receive-revenue use case (T-07).

import { appendIntents, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { receiveEstimate } from "../domain/estimate.ts";
import { projectEstimate } from "./projections.ts";

export type ReceiveRevenueCommand = {
  tenantId: string;
  estimateId: string;
};

export async function receiveRevenueUseCase(
  deps: RevenueDeps,
  cmd: ReceiveRevenueCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const estimate = projectEstimate(events, cmd.estimateId);
  if (estimate === null) {
    throw new Error(`Estimate ${cmd.estimateId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = receiveEstimate(estimate);
  if (intents.length === 0) return { changed: false };
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
  return { changed: true };
}