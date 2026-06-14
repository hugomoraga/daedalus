// Revenue Visibility — the Expense aggregate.
// Simple by design (Spec 001 §5: "Simple and flat in this phase (no categories, no allocation)").
// An expense has: id, label, amount, currency, occurredAt. Lifecycle is single-state: registered.

import type { EventIntent } from "@daedalus/core";
import { ExpenseRegistered } from "./events.ts";

export type Expense = {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: string;
  occurredAt: string; // ISO-8601
};

export function registerExpense(input: {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: string;
  occurredAt: string;
}): { expense: Expense; events: EventIntent[] } {
  if (input.label.trim().length === 0) {
    throw new Error("Expense requires a label");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Expense amount must be a non-negative finite number");
  }
  if (input.currency.trim().length === 0) {
    throw new Error("Expense requires a currency");
  }
  const expense: Expense = {
    id: input.id,
    tenantId: input.tenantId,
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    occurredAt: input.occurredAt,
  };
  return {
    expense,
    events: [
      {
        type: ExpenseRegistered,
        payload: {
          expenseId: expense.id,
          label: expense.label,
          amount: expense.amount,
          currency: expense.currency,
          occurredAt: expense.occurredAt,
        },
      },
    ],
  };
}