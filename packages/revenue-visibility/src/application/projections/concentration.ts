// Concentration: for a given event stream, find the largest single source's
// share of (confirmed + received). Returns ratio in [0, 1] or 0 if no revenue.

import type { DomainEvent } from "@daedalus/core";
import { rebuildAllEstimates } from "./_helpers.ts";

export function projectConcentrationRatio(events: DomainEvent[]): number {
  const estimates = rebuildAllEstimates(events);
  let confirmedPlusReceived = 0;
  let largest = 0;
  for (const est of estimates.values()) {
    if (est.state !== "confirmed" && est.state !== "received") continue;
    if (est.sourceProposalId === null) continue;
    confirmedPlusReceived += est.amount;
    if (est.amount > largest) largest = est.amount;
  }
  if (confirmedPlusReceived === 0) return 0;
  return largest / confirmedPlusReceived;
}
