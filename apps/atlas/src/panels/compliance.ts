// Compliance panel — Spec 007 T-23 + AC-9/AC-10/AC-11.
// Reads the tenant's event stream and projects obligation states via
// `deriveObligationStates` (pure, exported from `@daedalus/tax-compliance-guard`).
// Renders obligations grouped by status (pending / met / missed) with totals at
// the top and per-obligation provenance (rule set + version + last evaluation).
//
// Read-only. Never mutates state. Calls the pure projection directly with
// `ctx.events` (no re-read of JSONL).

import {
  deriveObligationStates,
  type ObligationState,
  type ObligorState,
} from "@daedalus/tax-compliance-guard";
import type { PanelContext } from "./register.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric, tag } from "../templates/paper.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;

export async function renderCompliancePanel(ctx: PanelContext): Promise<string> {
  const asOf = new Date().toISOString();
  const obligations = deriveObligationStates(ctx.events, asOf);

  return card(renderBody(obligations, asOf), { padding: tokens.space.s4 });
}

function renderBody(obligations: readonly ObligorState[], asOf: string): string {
  const totals = countByStatus(obligations);
  const dueSoon = obligations.filter((o) => isDueSoon(o.dueAt, asOf));
  const missed = obligations.filter((o) => o.status === "missed");
  const pending = obligations.filter((o) => o.status === "pending");
  const met = obligations.filter((o) => o.status === "met");

  const totalsSection = `
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s3}px; margin-bottom: ${tokens.space.s4}px;">
      ${metric("Pending", String(totals.pending))}
      ${metric("Met", String(totals.met))}
      ${metric("Missed", String(totals.missed))}
    </div>
  `;

  if (obligations.length === 0) {
    return `
      <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
        <h3 style="margin:0;">Compliance</h3>
        <span class="micro muted">tax & compliance obligations · asOf ${escapeHtml(asOf)}</span>
      </div>
      ${totalsSection}
      <div class="muted">no obligations tracked for this tenant</div>
    `;
  }

  return `
    <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom: ${tokens.space.s3}px;">
      <h3 style="margin:0;">Compliance</h3>
      <span class="micro muted">tax & compliance obligations · asOf ${escapeHtml(asOf)}</span>
    </div>
    ${totalsSection}
    ${dueSoon.length > 0 ? renderSection("Due in next 7 days", dueSoon, "warn") : ""}
    ${missed.length > 0 ? renderSection("Missed — action required", missed, "alert") : ""}
    ${pending.length > 0 ? renderSection("Pending", pending, "neutral") : ""}
    ${met.length > 0 ? renderSection("Met", met, "ok") : ""}
  `;
}

function renderSection(title: string, rows: readonly ObligorState[], tone: "ok" | "warn" | "alert" | "neutral"): string {
  const body = rows.map(renderObligationRow).join("");
  return `
    <div style="margin-bottom: ${tokens.space.s4}px; border-top: 1px solid var(--rule); padding-top: ${tokens.space.s3}px;">
      <div style="display:flex; align-items:baseline; gap: ${tokens.space.s2}px; margin-bottom: ${tokens.space.s2}px;">
        ${tag(title, tone)}
        <span class="micro muted">${rows.length}</span>
      </div>
      ${body}
    </div>
  `;
}

function renderObligationRow(o: ObligorState): string {
  const statusTag = tag(o.status.toUpperCase(), statusTone(o.status));
  const evalLine = o.lastEvaluation !== undefined
    ? `<div class="micro muted" style="margin-top: ${tokens.space.s1}px;">last policy: ${escapeHtml(o.lastEvaluation.outcome)} · ${escapeHtml(truncate(o.lastEvaluation.reason, 80))}</div>`
    : "";
  return `
    <div style="padding: ${tokens.space.s3}px 0; border-top: 1px solid var(--rule);">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap: ${tokens.space.s3}px;">
        <div>
          <div style="font-family: var(--mono);">${escapeHtml(o.obligationHumanName)}</div>
          <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">
            rule=${escapeHtml(o.ruleSetId)}@${escapeHtml(o.ruleSetVersion)} · action=${escapeHtml(o.requiredHumanAction)}
          </div>
          ${evalLine}
        </div>
        <div style="text-align:right;">
          ${statusTag}
          <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">due ${escapeHtml(formatDue(o.dueAt))}</div>
          <div class="micro muted">id=${escapeHtml(o.obligationId)}</div>
        </div>
      </div>
    </div>
  `;
}

function countByStatus(obligations: readonly ObligorState[]): Record<ObligationState, number> {
  const counts: Record<ObligationState, number> = { pending: 0, met: 0, missed: 0 };
  for (const o of obligations) counts[o.status] += 1;
  return counts;
}

function isDueSoon(dueAt: string, asOf: string): boolean {
  const dueMs = Date.parse(dueAt);
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(dueMs) || !Number.isFinite(asOfMs)) return false;
  const delta = dueMs - asOfMs;
  return delta > 0 && delta <= DUE_SOON_DAYS * DAY_MS;
}

function statusTone(status: ObligationState): "ok" | "warn" | "alert" | "neutral" {
  switch (status) {
    case "met": return "ok";
    case "pending": return "neutral";
    case "missed": return "alert";
  }
}

function formatDue(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toISOString().slice(0, 10);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
