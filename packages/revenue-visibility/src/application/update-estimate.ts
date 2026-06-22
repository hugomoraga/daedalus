// Revenue Visibility — update-estimate use case (T-06).

import { appendIntents, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { updateEstimate } from "../domain/estimate.ts";
import { projectEstimate } from "./projections/estimate.ts";

export type UpdateEstimateCommand = {
  tenantId: string;
  estimateId: string;
  amount?: number;
  notes?: string;
  label?: string;
};

export async function updateEstimateUseCase(
  deps: RevenueDeps,
  cmd: UpdateEstimateCommand,
): Promise<void> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const estimate = projectEstimate(events, cmd.estimateId);
  if (estimate === null) {
    throw new Error(`Estimate ${cmd.estimateId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = updateEstimate(estimate, {
    amount: cmd.amount,
    notes: cmd.notes,
    label: cmd.label,
  });
  if (intents.length === 0) return;
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
}