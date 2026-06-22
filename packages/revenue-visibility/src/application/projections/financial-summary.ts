// v1: FinancialSummary — the full read-model (Spec 001 §5).
// Reconstructable from the event stream; emits nothing on recompute.

import type { DomainEvent } from "@daedalus/core";
import { rebuildAllEstimates, sumByState, sumExpenses } from "./_helpers.ts";

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
  const expensesPerMonth = exp.expenses;
  const runwayMonths = expensesPerMonth > 0 ? revenue.received / expensesPerMonth : Number.POSITIVE_INFINITY;

  // Basic state: coarse (Spec 001 §5). Tied to runway only in this v0;
  // the alert engine handles the rule logic with thresholds.
  let basicState: BasicState = "unknown";
  if (revenue.received === 0 && exp.expenses === 0) {
    basicState = "unknown";
  } else if (revenue.received === 0 && exp.expenses > 0) {
    basicState = "at-risk";
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
