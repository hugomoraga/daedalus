// Revenue Visibility — alert domain types.
// Per Spec 001 §9, three rules (low_runway, revenue_concentration, negative_cashflow).
// Thresholds are tenant-injected; the engine is generic.

export type AlertRuleId = "low_runway" | "revenue_concentration" | "negative_cashflow";

export type AlertThresholds = {
  // Low runway: trigger if runway_months < runwayFloorMonths
  runwayFloorMonths: number;
  // Revenue concentration: trigger if any single source > concentrationCeilingRatio of
  // (confirmed + received). Ratio in [0, 1].
  concentrationCeilingRatio: number;
  // Negative cashflow: trigger if expenses > (confirmed + received) over the trailing
  // period (in months).
  cashflowPeriodMonths: number;
};

export type AlertSeverity = "high" | "medium";

export type AlertRule = {
  id: AlertRuleId;
  description: string;
  severity: AlertSeverity;
};