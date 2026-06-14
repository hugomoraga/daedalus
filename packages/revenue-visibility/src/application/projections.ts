// Revenue Visibility — read-model projections (T-03, T-09, T-10).
// All pure: replay events to compute the current view. No event on recompute.

import type { DomainEvent } from "@daedalus/core";
import type { RevenueState } from "../domain/revenue.ts";
import type { Estimate } from "../domain/estimate.ts";
import {
  RevenueEstimateCreated,
  RevenueEstimateUpdated,
  RevenueConfirmed,
  RevenueReceived,
  ExpenseRegistered,
} from "../domain/events.ts";

// Reconstruct a single estimate by replaying its events. Returns null if the estimate
// never had a Created event.
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

// v0 kept: legacy projection used by `revenue:show`.
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

// v1: FinancialSummary — the full read-model (Spec 001 §5).
// Reconstructable from the event stream; emits nothing on recompute.
export type BasicState = "healthy" | "watch" | "at-risk" | "unknown";

export type FinancialSummary = {
  currency: string;
  expected: number;
  expectedCount: number;
  confirmed: number;
  confirmedCount: number;
  received: number;
  receivedCount: number;
  expenses: number;
  expenseCount: number;
  // Approximate margin (Spec 001 §5): received (or confirmed) revenue − registered expenses.
  // "Received-based" is the most conservative; we expose received-based here. Q2 resolved.
  margin: number;
  // Simple runway: received_total / max(expenses_per_month, 1) over the trailing period.
  // Q3 resolved in Plan 001 §0.
  runwayMonths: number;
  basicState: BasicState;
};

type EstimateById = Map<string, Estimate>;

function rebuildAllEstimates(events: DomainEvent[]): EstimateById {
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

function sumByState(estimates: EstimateById): { expected: number; expectedCount: number; confirmed: number; confirmedCount: number; received: number; receivedCount: number; currency: string } {
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

function sumExpenses(events: DomainEvent[]): { expenses: number; expenseCount: number; currency: string } {
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

export function projectFinancialSummary(events: DomainEvent[]): FinancialSummary {
  const estimates = rebuildAllEstimates(events);
  const revenue = sumByState(estimates);
  const exp = sumExpenses(events);

  // The summary's currency is whichever the data shows first. Empty if no data.
  const currency = revenue.currency.length > 0 ? revenue.currency : exp.currency;
  const margin = revenue.received - exp.expenses;

  // Runway: received_total / max(expenses_per_month, 1).
  // We don't have the period in the projection (that's tenant config); pass a default of 1
  // and let the alert engine use the tenant's period for the threshold comparison.
  // For display: expenses-per-month over the trailing period in events. As a v0 default
  // we use 1 month (a "monthly burn" view). Tenants can set the period via thresholds;
  // the projection's runway is a coarse estimate.
  const expensesPerMonth = exp.expenses; // when we don't know the period, treat expenses as monthly burn
  const runwayMonths = expensesPerMonth > 0 ? revenue.received / expensesPerMonth : Number.POSITIVE_INFINITY;

  // Basic state: coarse (Spec 001 §5). Tied to runway only in this v0;
  // the alert engine handles the rule logic with thresholds.
  let basicState: BasicState = "unknown";
  if (revenue.received === 0 && exp.expenses === 0) {
    basicState = "unknown";
  } else if (revenue.received === 0 && exp.expenses > 0) {
    basicState = "at-risk"; // burning cash with no income
  } else if (runwayMonths >= 6) {
    basicState = "healthy";
  } else if (runwayMonths >= 3) {
    basicState = "watch";
  } else {
    basicState = "at-risk";
  }

  return {
    currency,
    expected: revenue.expected,
    expectedCount: revenue.expectedCount,
    confirmed: revenue.confirmed,
    confirmedCount: revenue.confirmedCount,
    received: revenue.received,
    receivedCount: revenue.receivedCount,
    expenses: exp.expenses,
    expenseCount: exp.expenseCount,
    margin,
    runwayMonths,
    basicState,
  };
}

// Concentration: for a given summary, find the largest single source's share of
// (confirmed + received). Returns ratio in [0, 1] or 0 if no revenue.
export function projectConcentrationRatio(events: DomainEvent[]): number {
  const estimates = rebuildAllEstimates(events);
  let confirmedPlusReceived = 0;
  let largest = 0;
  for (const est of estimates.values()) {
    if (est.state !== "confirmed" && est.state !== "received") continue;
    if (est.sourceProposalId === null) continue; // no source = untracked
    confirmedPlusReceived += est.amount;
    if (est.amount > largest) largest = est.amount;
  }
  if (confirmedPlusReceived === 0) return 0;
  return largest / confirmedPlusReceived;
}

// Negative cashflow ratio: expenses / (confirmed + received). >1 means burning more than earning.
// Returns Infinity if no revenue and there are expenses.
export function projectNegativeCashflowRatio(events: DomainEvent[]): number {
  const estimates = rebuildAllEstimates(events);
  let confirmedPlusReceived = 0;
  let expenses = 0;
  for (const est of estimates.values()) {
    if (est.state === "confirmed" || est.state === "received") {
      confirmedPlusReceived += est.amount;
    }
  }
  for (const event of events) {
    if (event.type === ExpenseRegistered) {
      expenses += Number(event.payload.amount ?? 0);
    }
  }
  if (confirmedPlusReceived === 0) return expenses > 0 ? Number.POSITIVE_INFINITY : 0;
  return expenses / confirmedPlusReceived;
}

// Suppress unused-warning for the RevenueState import (kept for type-level clarity above).
export type { RevenueState };