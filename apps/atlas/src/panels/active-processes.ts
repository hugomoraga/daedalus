// Active Processes panel — Spec 007 T-20.
// Reads workflow instances via the JsonlInstanceStoreAdapter, projects them
// through `projectActiveProcesses` (Spec 011 §4.2 / AC-5), renders one row
// per live instance sorted by ageMs descending.
//
// The panel is absent (404) when its backing model is not registered. It is
// read-only and never mutates state.

import {
  projectActiveProcesses,
  type ActiveProcessView,
} from "@daedalus/workflow-engine";
import type { PanelContext } from "./register.ts";
import type { AtlasDeps } from "../deps.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, tag } from "../templates/paper.ts";

export type ActiveProcessesDeps = Pick<AtlasDeps, "instanceStore">;

export async function renderActiveProcessesPanel(
  ctx: PanelContext,
  deps: ActiveProcessesDeps,
): Promise<string> {
  const tenantId = ctx.tenant.tenantId;
  const instances = await deps.instanceStore.list(tenantId);
  const now = new Date().toISOString();
  const view = projectActiveProcesses(instances, now);

  return card(renderBody(view), { padding: tokens.space.s4 });
}

function renderBody(view: readonly ActiveProcessView[]): string {
  if (view.length === 0) {
    return `
      <h3 style="margin-bottom: ${tokens.space.s3}px;">Active Processes</h3>
      <div class="muted">no live workflow instances for this tenant</div>
    `;
  }

  const rows = view.map((r) => `
    <div style="display:grid; grid-template-columns: 1fr auto; gap: ${tokens.space.s2}px; padding: ${tokens.space.s3}px 0; border-top: 1px solid var(--rule); align-items:center;">
      <div>
        <div style="font-family: var(--mono); font-size: 0.92em;">
          ${escapeHtml(r.workflowName)} <span class="muted">@ ${escapeHtml(r.workflowVersion)}</span>
        </div>
        <div style="margin-top: ${tokens.space.s1}px;">
          <span class="micro">state=</span><span style="font-family: var(--mono);">${escapeHtml(r.currentState)}</span>
          <span class="micro muted" style="margin-left: ${tokens.space.s3}px;">corr=${escapeHtml(r.correlationId)}</span>
        </div>
        ${
          r.pendingTransitionId !== null
            ? `<div style="margin-top: ${tokens.space.s1}px;"><span class="micro muted">pending=${escapeHtml(r.pendingTransitionId)}</span></div>`
            : ""
        }
      </div>
      <div style="text-align: right;">
        ${tag(r.status === "waiting_human" ? "WAITING" : "ACTIVE", r.status === "waiting_human" ? "warn" : "neutral")}
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">${formatAge(r.ageMs)}</div>
        ${
          r.lastFiredAt !== null
            ? `<div class="micro muted">last=${escapeHtml(r.lastFiredAt)}</div>`
            : ""
        }
      </div>
    </div>
  `).join("");

  return `
    <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
      <h3 style="margin:0;">Active Processes</h3>
      <span class="micro muted">${view.length} live · sorted by age desc</span>
    </div>
    ${rows}
  `;
}

function formatAge(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}
