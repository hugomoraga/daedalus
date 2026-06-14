// Revenue Visibility — manual create-estimate use case (T-06: standalone items).
// Per Spec 001 AC-1, a founder can record a manual estimate (no Core link).

import { appendIntents, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { createEstimate } from "../domain/estimate.ts";

export type CreateEstimateCommand = {
  tenantId: string;
  label: string;
  amount: number;
  currency: string;
  notes?: string;
};

export async function createEstimateUseCase(
  deps: RevenueDeps,
  cmd: CreateEstimateCommand,
): Promise<{ estimateId: string }> {
  const id = deps.newId();
  const { estimate, events } = createEstimate({
    id,
    tenantId: cmd.tenantId,
    label: cmd.label,
    amount: cmd.amount,
    currency: cmd.currency,
    notes: cmd.notes,
  });
  await appendIntents(deps, cmd.tenantId, events, startLineage(deps.newId));
  return { estimateId: estimate.id };
}