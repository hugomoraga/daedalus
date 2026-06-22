// Internal helpers shared by the FinancialSummary, concentration, and
// negative-cashflow projections. Not re-exported from the package barrel.

import type { DomainEvent } from "@daedalus/core";
import type { Estimate } from "../../domain/estimate.ts";
import {
  RevenueEstimateCreated,
  RevenueEstimateUpdated,
  RevenueConfirmed,
  RevenueReceived,
  ExpenseRegistered,
} from "../../domain/events.ts";

export type EstimateById = Map<string, Estimate>;

export function rebuildAllEstimates(events: DomainEvent[]): EstimateById {
  const map: EstimateById = new Map();
  for (const event of events) {
    const id = event.payload.estimateId as string | undefined;
    if (id === undefined) continue;
    let estimate = map.get(id);
    switch (event.type) {
      case RevenueEstimateCreated:
        estimate = {
          id,
          tenantId: event.tenantId,
          label: String(event.payload.label ?? ""),
          amount: Number(event.payload.amount ?? 0),
          currency: String(event.payload.currency ?? ""),
          state: "expected",
          sourceProposalId: (event.payload.sourceProposalId as string | null) ?? null,
          notes: String(event.payload.notes ?? ""),
        };
        map.set(id, estimate);
        break;
      case RevenueEstimateUpdated:
        if (estimate) {
          estimate = {
            ...estimate,
            amount: Number(event.payload.amount ?? estimate.amount),
            notes: String(event.payload.notes ?? estimate.notes),
            label: String(event.payload.label ?? estimate.label),
          };
          map.set(id, estimate);
        }
        break;
      case RevenueConfirmed:
        if (estimate) {
          estimate = { ...estimate, state: "confirmed" };
          map.set(id, estimate);
        }
        break;
      case RevenueReceived:
        if (estimate) {
          estimate = { ...estimate, state: "received" };
          map.set(id, estimate);
        }
        break;
    }
  }
  return map;
}

export type RevenueRollup = {
  expected: number;
  expectedCount: number;
  confirmed: number;
  confirmedCount: number;
  received: number;
  receivedCount: number;
  currency: string;
};

export function sumByState(estimates: EstimateById): RevenueRollup {
  let expected = 0;
  let expectedCount = 0;
  let confirmed = 0;
  let confirmedCount = 0;
  let received = 0;
  let receivedCount = 0;
  let currency = "";
  for (const est of estimates.values()) {
    if (currency.length === 0) currency = est.currency;
    if (est.state === "expected") {
      expected += est.amount;
      expectedCount += 1;
    } else if (est.state === "confirmed") {
      confirmed += est.amount;
      confirmedCount += 1;
    } else if (est.state === "received") {
      received += est.amount;
      receivedCount += 1;
    }
  }
  return { expected, expectedCount, confirmed, confirmedCount, received, receivedCount, currency };
}

export type ExpenseRollup = { expenses: number; expenseCount: number; currency: string };

export function sumExpenses(events: DomainEvent[]): ExpenseRollup {
  let expenses = 0;
  let count = 0;
  let currency = "";
  for (const event of events) {
    if (event.type !== ExpenseRegistered) continue;
    expenses += Number(event.payload.amount ?? 0);
    count += 1;
    currency = String(event.payload.currency ?? currency);
  }
  return { expenses, expenseCount: count, currency };
}
