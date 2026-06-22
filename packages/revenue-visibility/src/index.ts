// @daedalus/revenue-visibility v1 — explicit public contract.
// Use cases, command types, and the domain types strictly necessary to consume them.
// The event-type constants and the adapter are NOT here —
//   import event constants from internal: not exposed
//   import adapter from "@daedalus/revenue-visibility/adapters"
//
// v0 kept: ingestProposalRevenueUseCase, projectExpectedRevenue, RevenueSummary.
// v1 adds: full lifecycle (create/update/confirm/receive), expenses, snapshots, alerts,
//          and the FinancialSummary projection.

// Public types
export type { RevenueDeps } from "./application/deps.ts";
export type { AlertThresholdsPort } from "./application/ports/alert-thresholds.ts";
export type { RevenueState } from "./domain/revenue.ts";
export type { Estimate } from "./domain/estimate.ts";
export type { Expense } from "./domain/expense.ts";
export type { AlertThresholds, AlertRuleId, AlertSeverity, AlertRule } from "./domain/alert.ts";
export type { RevenueSummary } from "./application/projections/expected-revenue.ts";
export type { FinancialSummary, BasicState } from "./application/projections/financial-summary.ts";

// Command types
export type { IngestProposalRevenueCommand } from "./application/ingest-proposal-revenue.ts";
export type { CreateEstimateCommand } from "./application/create-estimate.ts";
export type { UpdateEstimateCommand } from "./application/update-estimate.ts";
export type { ConfirmRevenueCommand } from "./application/confirm-revenue.ts";
export type { ReceiveRevenueCommand } from "./application/receive-revenue.ts";
export type { RegisterExpenseCommand } from "./application/register-expense.ts";
export type { TakeSnapshotCommand } from "./application/take-snapshot.ts";
export type { EvaluateAlertsCommand, AlertResult } from "./application/evaluate-alerts.ts";

// Use cases
export { ingestProposalRevenueUseCase } from "./application/ingest-proposal-revenue.ts";
export { createEstimateUseCase } from "./application/create-estimate.ts";
export { updateEstimateUseCase } from "./application/update-estimate.ts";
export { confirmRevenueUseCase } from "./application/confirm-revenue.ts";
export { receiveRevenueUseCase } from "./application/receive-revenue.ts";
export { registerExpenseUseCase } from "./application/register-expense.ts";
export { takeSnapshotUseCase } from "./application/take-snapshot.ts";
export { evaluateAlertsUseCase } from "./application/evaluate-alerts.ts";

// Projections (read-models)
export { projectExpectedRevenue } from "./application/projections/expected-revenue.ts";
export { projectFinancialSummary } from "./application/projections/financial-summary.ts";
export { projectEstimate } from "./application/projections/estimate.ts";
export { projectConcentrationRatio } from "./application/projections/concentration.ts";
export { projectNegativeCashflowRatio } from "./application/projections/negative-cashflow.ts";