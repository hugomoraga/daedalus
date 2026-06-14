// Revenue Visibility — take-snapshot use case (T-12).
// Captures the current FinancialSummary as an immutable event.

import { appendIntents, enrich, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { projectFinancialSummary } from "./projections.ts";
import { RevenueSnapshotGenerated } from "../domain/events.ts";

export type TakeSnapshotCommand = {
  tenantId: string;
};

export async function takeSnapshotUseCase(
  deps: RevenueDeps,
  cmd: TakeSnapshotCommand,
): Promise<{ summary: ReturnType<typeof projectFinancialSummary> }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const summary = projectFinancialSummary(events);
  const lineage = startLineage(deps.newId);
  await deps.eventStore.append(
    enrich(
      {
        type: RevenueSnapshotGenerated,
        payload: {
          summaryAtEventTime: {
            expected: summary.expected,
            confirmed: summary.confirmed,
            received: summary.received,
            expenses: summary.expenses,
            margin: summary.margin,
            runwayMonths: summary.runwayMonths,
            basicState: summary.basicState,
            currency: summary.currency,
          },
        },
      },
      { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage },
    ),
  );
  return { summary };
}