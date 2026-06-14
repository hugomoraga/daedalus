// Revenue Visibility — register-expense use case (T-08).
// Single event per expense, no updates (Spec 001: "Simple and flat").

import { appendIntents, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { registerExpense } from "../domain/expense.ts";

export type RegisterExpenseCommand = {
  tenantId: string;
  label: string;
  amount: number;
  currency: string;
};

export async function registerExpenseUseCase(
  deps: RevenueDeps,
  cmd: RegisterExpenseCommand,
): Promise<{ expenseId: string }> {
  const id = deps.newId();
  const { expense, events } = registerExpense({
    id,
    tenantId: cmd.tenantId,
    label: cmd.label,
    amount: cmd.amount,
    currency: cmd.currency,
    occurredAt: deps.now(),
  });
  await appendIntents(deps, cmd.tenantId, events, startLineage(deps.newId));
  return { expenseId: expense.id };
}