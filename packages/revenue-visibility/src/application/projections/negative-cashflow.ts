// Negative cashflow ratio: expenses / (confirmed + received). >1 means
// burning more than earning. Returns Infinity if no revenue and there are expenses.

import type { DomainEvent } from "@daedalus/core";
import { rebuildAllEstimates, sumExpenses } from "./_helpers.ts";

export function projectNegativeCashflowRatio(events: DomainEvent[]): number {
  const estimates = rebuildAllEstimates(events);
  let confirmedPlusReceived = 0;
  for (const est of estimates.values()) {
    if (est.state === "confirmed" || est.state === "received") {
      confirmedPlusReceived += est.amount;
    }
  }
  const { expenses } = sumExpenses(events);
  if (confirmedPlusReceived === 0) return expenses > 0 ? Number.POSITIVE_INFINITY : 0;
  return expenses / confirmedPlusReceived;
}
