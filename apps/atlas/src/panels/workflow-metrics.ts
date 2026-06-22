// Workflow Metrics panel — Spec 007 T-22.
// Reads workflow instances, projects them through `projectWorkflowMetrics`
// (Spec 011 §4.2 / AC-7). Window defaults to last 24h. Renders per-workflow
// completion/compensation counts + avg completion time + totals.
//
// Read-only. Never mutates state.

import {
  projectWorkflowMetrics,
  type WorkflowMetrics,
  type WorkflowMetricsByWorkflow,
} from "@daedalus/workflow-engine";
import type { PanelContext } from "./register.ts";
import type { AtlasDeps } from "../deps.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric } from "../templates/paper.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type WorkflowMetricsDeps = Pick<AtlasDeps, "instanceStore">;

export async function renderWorkflowMetricsPanel(
  ctx: PanelContext,
  deps: WorkflowMetricsDeps,
): Promise<string> {
  const tenantId = ctx.tenant.tenantId;
  const now = new Date();
  const sinceIso = new Date(now.getTime() - DAY_MS).toISOString();
  const nowIso = now.toISOString();

  const instances = await deps.instanceStore.list(tenantId, { limit: 1000 });
  const metrics = projectWorkflowMetrics(instances, sinceIso, nowIso);

  return card(renderBody(metrics, sinceIso, nowIso), { padding: tokens.space.s4 });
}

function renderBody(m: WorkflowMetrics, sinceIso: string, nowIso: string): string {
  const totalsSection = `
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s3}px; margin-bottom: ${tokens.space.s4}px;">
      ${metric("Completed", String(m.totals.completedInWindow))}
      ${metric("Compensated", String(m.totals.compensatedInWindow))}
      ${metric("Avg completion", m.totals.avgCompletionMs === null ? "—" : formatDuration(m.totals.avgCompletionMs))}
    </div>
  `;

  if (m.byWorkflow.length === 0) {
    return `
      <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
        <h3 style="margin:0;">Workflow Metrics</h3>
        <span class="micro muted">window 24h · ${escapeHtml(sinceIso)} → ${escapeHtml(nowIso)}</span>
      </div>
      ${totalsSection}
      <div class="muted">no terminal workflow activity in window</div>
    `;
  }

  const rows = m.byWorkflow.map(renderRow).join("");
  return `
    <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
      <h3 style="margin:0;">Workflow Metrics</h3>
      <span class="micro muted">window 24h · ${escapeHtml(sinceIso)} → ${escapeHtml(nowIso)}</span>
    </div>
    ${totalsSection}
    <div style="border-top: 1px solid var(--rule);">
      ${rows}
    </div>
  `;
}

function renderRow(row: WorkflowMetricsByWorkflow): string {
  return `
    <div style="display:grid; grid-template-columns: 1fr auto auto auto; gap: ${tokens.space.s3}px; padding: ${tokens.space.s2}px 0; border-bottom: 1px solid var(--rule); align-items:center;">
      <div style="font-family: var(--mono);">${escapeHtml(row.workflowName)}</div>
      <div class="micro muted" style="text-align:right;">done=${row.completedInWindow}</div>
      <div class="micro muted" style="text-align:right;">comp=${row.compensatedInWindow}</div>
      <div class="micro" style="text-align:right; min-width: 90px; font-family: var(--mono);">avg=${row.avgCompletionMs === null ? "—" : formatDuration(row.avgCompletionMs)}</div>
    </div>
  `;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}
