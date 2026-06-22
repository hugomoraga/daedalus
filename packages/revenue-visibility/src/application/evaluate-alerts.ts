// Revenue Visibility — evaluate-alerts use case (T-11).
// Per Spec 001 §6 / AC-6: "emit once per condition until it clears (no alert spam)".
// Algorithm: rebuild alerts, find currently-raised ones, find previously-flagged ones in
// the event log, emit FinancialRiskFlagged for any newly raised condition.

import { enrich, startLineage } from "@daedalus/core";
import type { RevenueDeps } from "./deps.ts";
import { FinancialRiskFlagged } from "../domain/events.ts";
import type { AlertRuleId } from "../domain/alert.ts";
import {
  projectFinancialSummary,
} from "./projections/financial-summary.ts";
import { projectConcentrationRatio } from "./projections/concentration.ts";
import { projectNegativeCashflowRatio } from "./projections/negative-cashflow.ts";

export type AlertResult = {
  ruleId: AlertRuleId;
  triggered: boolean;
  threshold: number;
  actual: number;
};

export type EvaluateAlertsCommand = {
  tenantId: string;
};

export async function evaluateAlertsUseCase(
  deps: RevenueDeps,
  cmd: EvaluateAlertsCommand,
): Promise<{ raised: AlertResult[]; cleared: AlertRuleId[] }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const thresholds = await deps.thresholds.load(cmd.tenantId);
  const summary = projectFinancialSummary(events);

  // Compute current state per rule.
  const current: AlertResult[] = [
    {
      ruleId: "low_runway",
      triggered: summary.runwayMonths < thresholds.runwayFloorMonths,
      threshold: thresholds.runwayFloorMonths,
      actual: summary.runwayMonths,
    },
    {
      ruleId: "revenue_concentration",
      triggered: projectConcentrationRatio(events) > thresholds.concentrationCeilingRatio,
      threshold: thresholds.concentrationCeilingRatio,
      actual: projectConcentrationRatio(events),
    },
    {
      ruleId: "negative_cashflow",
      triggered: projectNegativeCashflowRatio(events) > 1,
      threshold: 1,
      actual: projectNegativeCashflowRatio(events),
    },
  ];

  // Currently raised set
  const currentlyRaised = new Set(current.filter((r) => r.triggered).map((r) => r.ruleId));
  // Previously raised = any ruleId that has at least one FinancialRiskFlagged in the stream
  const previouslyRaised = new Set<AlertRuleId>();
  for (const e of events) {
    if (e.type === FinancialRiskFlagged) {
      const id = e.payload.ruleId as AlertRuleId | undefined;
      if (id !== undefined) previouslyRaised.add(id);
    }
  }

  // Emit a new flag for any rule that is raised now but not raised before.
  // Per AC-6 "emit once per condition until it clears".
  const lineage = startLineage(deps.newId);
  const raised: AlertResult[] = [];
  for (const r of current) {
    if (r.triggered && !previouslyRaised.has(r.ruleId)) {
      raised.push(r);
      await deps.eventStore.append(
        enrich(
          {
            type: FinancialRiskFlagged,
            payload: {
              ruleId: r.ruleId,
              threshold: r.threshold,
              actual: r.actual,
            },
          },
          { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage },
        ),
      );
    }
  }

  // Cleared: previously raised but no longer triggered.
  const cleared: AlertRuleId[] = [];
  for (const id of previouslyRaised) {
    if (!currentlyRaised.has(id)) cleared.push(id);
  }

  return { raised, cleared };
}