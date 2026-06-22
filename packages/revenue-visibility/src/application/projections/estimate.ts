// Single-estimate projection (replay this estimate's events).

import type { DomainEvent } from "@daedalus/core";
import type { Estimate } from "../../domain/estimate.ts";
import {
  RevenueEstimateCreated,
  RevenueEstimateUpdated,
  RevenueConfirmed,
  RevenueReceived,
} from "../../domain/events.ts";

export function projectEstimate(events: DomainEvent[], estimateId: string): Estimate | null {
  let estimate: Estimate | null = null;
  for (const event of events) {
    const id = event.payload.estimateId as string | undefined;
    if (id !== estimateId) continue;
    switch (event.type) {
      case RevenueEstimateCreated:
        estimate = {
          id: estimateId,
          tenantId: event.tenantId,
          label: String(event.payload.label ?? ""),
          amount: Number(event.payload.amount ?? 0),
          currency: String(event.payload.currency ?? ""),
          state: "expected",
          sourceProposalId: (event.payload.sourceProposalId as string | null) ?? null,
          notes: String(event.payload.notes ?? ""),
        };
        break;
      case RevenueEstimateUpdated:
        if (estimate) {
          estimate = {
            ...estimate,
            amount: Number(event.payload.amount ?? estimate.amount),
            notes: String(event.payload.notes ?? estimate.notes),
            label: String(event.payload.label ?? estimate.label),
          };
        }
        break;
      case RevenueConfirmed:
        if (estimate) estimate = { ...estimate, state: "confirmed" };
        break;
      case RevenueReceived:
        if (estimate) estimate = { ...estimate, state: "received" };
        break;
    }
  }
  return estimate;
}
