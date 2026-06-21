// Monitoring panel — FinancialSummary + alerts.
// Reads the Revenue Visibility v1 projection (pure) and the alert engine (deps).
// Spec 007 §v1: Throughput + Monitoring panels.

import type { DomainEvent } from "@daedalus/core";
import { projectFinancialSummary, type FinancialSummary } from "@daedalus/revenue-visibility";
import { evaluateAlertsUseCase, type AlertResult } from "@daedalus/revenue-visibility";
import type { PanelContext } from "./register.ts";
import type { AtlasDeps } from "../deps.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric, tag } from "../templates/paper.ts";

export type MonitoringDeps = Pick<AtlasDeps, "eventStore" | "thresholds" | "newId" | "now" | "actor">;

export async function renderMonitoringPanel(
  ctx: PanelContext,
  deps: MonitoringDeps,
): Promise<string> {
  const events = ctx.events;
  const summary = projectFinancialSummary(events as DomainEvent[]);
  const currency = summary.currency.length === 0 ? ctx.tenant.currency : summary.currency;

  const alertResult = await evaluateAlertsUseCase(deps as never, { tenantId: ctx.tenant.tenantId });
  const raised = alertResult.raised;
  const cleared = alertResult.cleared;

  const stateTone =
    summary.basicState === "healthy" ? "ok" :
    summary.basicState === "watch" ? "neutral" :
    summary.basicState === "at-risk" ? "alert" :
    "neutral";

  return card(`
    <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s5}px;">
      <div>
        <h2>Monitoring</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">financial summary · alert engine · tenant-injected thresholds</div>
      </div>
      <div>${tag(summary.basicState.toUpperCase(), stateTone)}</div>
    </header>

    ${renderSummaryGrid(summary, currency)}
    ${renderAlertSection(raised, cleared)}
  `);
}

function renderSummaryGrid(s: FinancialSummary, currency: string): string {
  const runway = Number.isFinite(s.runwayMonths) ? s.runwayMonths.toFixed(2) : "∞";
  return `
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: ${tokens.space.s5}px; margin-bottom: ${tokens.space.s5}px;">
      ${metric("Expected", String(s.expected), `${s.expectedCount} estimate${s.expectedCount === 1 ? "" : "s"}`)}
      ${metric("Confirmed", String(s.confirmed), `${s.confirmedCount} confirmed`)}
      ${metric("Received", String(s.received), `${s.receivedCount} received`)}
      ${metric("Runway (months)", runway, `${s.expenseCount} expense${s.expenseCount === 1 ? "" : "s"} on record`)}
    </div>
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s5}px; margin-bottom: ${tokens.space.s5}px; padding-top: ${tokens.space.s4}px; border-top: 1px solid var(--rule);">
      ${metric("Expenses", `${s.expenses} ${currency}`, "registered")}
      ${metric("Margin", `${s.margin} ${currency}`, "received − expenses")}
      ${metric("Currency", currency, "from first event")}
    </div>
  `;
}

function renderAlertSection(raised: readonly AlertResult[], cleared: readonly string[]): string {
  if (raised.length === 0 && cleared.length === 0) {
    return `
      <div style="border-top: 1px solid var(--rule); padding-top: ${tokens.space.s4}px;">
        <h3 style="margin-bottom: ${tokens.space.s3}px;">Alerts</h3>
        <div class="muted">no alert changes since last evaluation</div>
      </div>
    `;
  }
  const rows = raised.map((r) => `
    <div style="display:flex; align-items:center; gap: ${tokens.space.s3}px; padding: ${tokens.space.s2}px 0; border-top: 1px solid var(--rule);">
      ${tag("RAISED", "alert")}
      <span style="flex:1;">${escapeHtml(r.ruleId)}</span>
      <span class="micro muted">threshold=${escapeHtml(String(r.threshold))}  actual=${escapeHtml(String(Number.isFinite(r.actual) ? r.actual.toFixed(2) : r.actual))}</span>
    </div>
  `).join("");
  const clearedRows = cleared.map((id) => `
    <div style="display:flex; align-items:center; gap: ${tokens.space.s3}px; padding: ${tokens.space.s2}px 0; border-top: 1px solid var(--rule);">
      ${tag("CLEARED", "ok")}
      <span style="flex:1;">${escapeHtml(id)}</span>
    </div>
  `).join("");
  return `
    <div style="border-top: 1px solid var(--rule); padding-top: ${tokens.space.s4}px;">
      <h3 style="margin-bottom: ${tokens.space.s3}px;">Alerts</h3>
      ${rows}${clearedRows}
    </div>
  `;
}