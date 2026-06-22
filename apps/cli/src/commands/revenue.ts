import {
  ingestProposalRevenueUseCase,
  createEstimateUseCase,
  updateEstimateUseCase,
  confirmRevenueUseCase,
  receiveRevenueUseCase,
  registerExpenseUseCase,
  takeSnapshotUseCase,
  evaluateAlertsUseCase,
  projectExpectedRevenue,
  projectFinancialSummary,
} from "@daedalus/revenue-visibility";
import type { CommandHandler } from "./types.ts";
import { requireOpt, tenantCurrency } from "./types.ts";

const revenueIngest: CommandHandler = async ({ tenantId, deps }) => {
  const out = await ingestProposalRevenueUseCase(deps, { tenantId });
  console.log(
    `revenue:ingest  ingested=${out.ingested}  confirmed=${out.confirmed}  received=${out.received}`,
  );
};

const revenueShow: CommandHandler = async ({ tenantId, deps }) => {
  const events = await deps.eventStore.readStream(tenantId);
  const summary = projectExpectedRevenue(events);
  const currency = summary.count === 0 ? tenantCurrency(tenantId) : summary.currency;
  console.log(`expected revenue: ${summary.expected} ${currency}  (${summary.count} estimate(s))`);
};

const revenueCreate: CommandHandler = async ({ tenantId, values, deps }) => {
  const amount = Number(requireOpt(values.amount, "amount"));
  if (!Number.isFinite(amount)) throw new Error("--amount must be a number");
  const out = await createEstimateUseCase(deps, {
    tenantId,
    label: requireOpt(values.label, "label"),
    amount,
    currency: tenantCurrency(tenantId),
    notes: values.notes,
  });
  console.log(`RevenueEstimateCreated  estimate=${out.estimateId}`);
};

const revenueUpdate: CommandHandler = async ({ tenantId, values, deps }) => {
  const amount = values.amount !== undefined ? Number(values.amount) : undefined;
  if (amount !== undefined && !Number.isFinite(amount)) throw new Error("--amount must be a number");
  await updateEstimateUseCase(deps, {
    tenantId,
    estimateId: requireOpt(values.estimate, "estimate"),
    amount,
    notes: values.notes,
  });
  console.log(`RevenueEstimateUpdated  estimate=${values.estimate}`);
};

const revenueConfirm: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await confirmRevenueUseCase(deps, {
    tenantId,
    estimateId: requireOpt(values.estimate, "estimate"),
  });
  console.log(
    out.changed
      ? `RevenueConfirmed  estimate=${values.estimate}`
      : `already confirmed or received  estimate=${values.estimate}`,
  );
};

const revenueReceive: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await receiveRevenueUseCase(deps, {
    tenantId,
    estimateId: requireOpt(values.estimate, "estimate"),
  });
  console.log(
    out.changed
      ? `RevenueReceived  estimate=${values.estimate}`
      : `already received  estimate=${values.estimate}`,
  );
};

const expenseRegister: CommandHandler = async ({ tenantId, values, deps }) => {
  const amount = Number(requireOpt(values.amount, "amount"));
  if (!Number.isFinite(amount)) throw new Error("--amount must be a number");
  const out = await registerExpenseUseCase(deps, {
    tenantId,
    label: requireOpt(values.label, "label"),
    amount,
    currency: tenantCurrency(tenantId),
  });
  console.log(`ExpenseRegistered  expense=${out.expenseId}  "${values.label}"=${amount}`);
};

const revenueSnapshot: CommandHandler = async ({ tenantId, deps }) => {
  await takeSnapshotUseCase(deps, { tenantId });
  console.log(`RevenueSnapshotGenerated  tenant=${tenantId}`);
};

const revenueSummary: CommandHandler = async ({ tenantId, deps }) => {
  const events = await deps.eventStore.readStream(tenantId);
  const s = projectFinancialSummary(events);
  const currency = s.currency.length === 0 ? tenantCurrency(tenantId) : s.currency;
  console.log("=== Financial Summary ===");
  console.log(`currency:        ${currency}`);
  console.log(`expected:        ${s.expected}  (${s.expectedCount} estimate${s.expectedCount === 1 ? "" : "s"})`);
  console.log(`confirmed:       ${s.confirmed}  (${s.confirmedCount})`);
  console.log(`received:        ${s.received}  (${s.receivedCount})`);
  console.log(`expenses:        ${s.expenses}  (${s.expenseCount})`);
  console.log(`margin:          ${s.margin} ${currency}`);
  console.log(`runway (months): ${Number.isFinite(s.runwayMonths) ? s.runwayMonths.toFixed(2) : "∞"}`);
  console.log(`basic state:     ${s.basicState}`);
};

const revenueAlerts: CommandHandler = async ({ tenantId, deps }) => {
  const out = await evaluateAlertsUseCase(deps, { tenantId });
  if (out.raised.length === 0 && out.cleared.length === 0) {
    console.log("no alert changes");
  } else {
    for (const a of out.raised) {
      console.log(`RAISED  ${a.ruleId}  threshold=${a.threshold}  actual=${a.actual}`);
    }
    for (const id of out.cleared) {
      console.log(`CLEARED  ${id}`);
    }
  }
};

export const handlers: Array<[string, CommandHandler]> = [
  ["revenue:ingest", revenueIngest],
  ["revenue:show", revenueShow],
  ["revenue:create", revenueCreate],
  ["revenue:update", revenueUpdate],
  ["revenue:confirm", revenueConfirm],
  ["revenue:receive", revenueReceive],
  ["expense:register", expenseRegister],
  ["revenue:snapshot", revenueSnapshot],
  ["revenue:summary", revenueSummary],
  ["revenue:alerts", revenueAlerts],
];
