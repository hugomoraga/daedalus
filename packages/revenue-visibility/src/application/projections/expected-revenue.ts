// v0 kept: legacy projection used by `revenue:show`.

import type { DomainEvent } from "@daedalus/core";
import { RevenueEstimateCreated } from "../../domain/events.ts";

export type RevenueSummary = {
  currency: string;
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
