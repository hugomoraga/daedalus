// Queue Status panel — Spec 007 T-21.
// Reads workflow instances, projects them through `projectQueueStatus`
// (Spec 011 §4.2 / AC-6). Renders per-workflow counts (sorted by
// waitingHumanCount desc then activeCount desc) plus totals.
//
// Read-only. Never mutates state.

import {
  projectQueueStatus,
  type QueueStatus,
  type QueueStatusByWorkflow,
} from "@daedalus/workflow-engine";
import type { PanelContext } from "./register.ts";
import type { AtlasDeps } from "../deps.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric, tag } from "../templates/paper.ts";

export type QueueStatusDeps = Pick<AtlasDeps, "instanceStore">;

export async function renderQueueStatusPanel(
  ctx: PanelContext,
  deps: QueueStatusDeps,
): Promise<string> {
  const tenantId = ctx.tenant.tenantId;
  const instances = await deps.instanceStore.list(tenantId, { limit: 1000 });
  const now = new Date().toISOString();
  const queue = projectQueueStatus(instances, now);

  return card(renderBody(queue), { padding: tokens.space.s4 });
}

function renderBody(queue: QueueStatus): string {
  const totalsSection = `
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: ${tokens.space.s3}px; margin-bottom: ${tokens.space.s4}px;">
      ${metric("Active", String(queue.totals.active))}
      ${metric("Waiting human", String(queue.totals.waitingHuman))}
      ${metric("Completed 24h", String(queue.totals.completed24h))}
      ${metric("Compensated 24h", String(queue.totals.compensated24h))}
    </div>
  `;

  if (queue.byWorkflow.length === 0) {
    return `
      <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
        <h3 style="margin:0;">Queue Status</h3>
        <span class="micro muted">by workflow · sorted by waiting desc</span>
      </div>
      ${totalsSection}
      <div class="muted">no live workflow activity</div>
    `;
  }

  const rows = queue.byWorkflow.map(renderRow).join("");
  return `
    <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
      <h3 style="margin:0;">Queue Status</h3>
      <span class="micro muted">by workflow · sorted by waiting desc</span>
    </div>
    ${totalsSection}
    <div style="border-top: 1px solid var(--rule);">
      ${rows}
    </div>
  `;
}

function renderRow(row: QueueStatusByWorkflow): string {
  const waitingTone = row.waitingHumanCount > 0 ? "warn" : "neutral";
  return `
    <div style="display:grid; grid-template-columns: 1fr auto auto; gap: ${tokens.space.s3}px; padding: ${tokens.space.s2}px 0; border-bottom: 1px solid var(--rule); align-items:center;">
      <div style="font-family: var(--mono);">${escapeHtml(row.workflowName)}</div>
      <div style="text-align:right;">${tag(`ACTIVE ${row.activeCount}`, "neutral")}</div>
      <div style="text-align:right; min-width: 130px;">${tag(`WAITING ${row.waitingHumanCount}`, waitingTone)}</div>
    </div>
  `;
}
