// Revenue Visibility — module domain event types.
// Per Spec 001 §6: events fire only on auditable facts/decisions.
// Reading the live summary emits no event (it's a read-model).

export const RevenueEstimateCreated = "RevenueEstimateCreated";
export const RevenueEstimateUpdated = "RevenueEstimateUpdated";
export const RevenueConfirmed = "RevenueConfirmed";
export const RevenueReceived = "RevenueReceived";
export const ExpenseRegistered = "ExpenseRegistered";
export const RevenueSnapshotGenerated = "RevenueSnapshotGenerated";
export const FinancialRiskFlagged = "FinancialRiskFlagged";
