// Read-model: the expected-revenue summary, reconstructed by replaying events.
// Pure projection — emits nothing (the live view is a read-model, per Spec 001 §6).

import type { DomainEvent } from "@daedalus/core";
import { RevenueEstimateCreated } from "../domain/events.ts";

export type RevenueSummary = {
  currency: string; // "" when there are no estimates yet
  expected: number;
  count: number;
};

export function projectExpectedRevenue(events: DomainEvent[]): RevenueSummary {
  let expected = 0;
  let count = 0;
  let currency = "";
  for (const event of events) {
    if (event.type !== RevenueEstimateCreated) continue;
    if (event.payload.state !== "expected") continue;
    expected += Number(event.payload.amount ?? 0);
    currency = String(event.payload.currency ?? currency);
    count += 1;
  }
  return { currency, expected, count };
}
