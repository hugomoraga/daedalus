// Events panel — raw event stream with full lineage (correlationId, causationId).
// Server-side only; the browser receives rendered HTML, never raw JSONL.

import type { DomainEvent } from "@daedalus/core";
import type { PanelContext } from "./register.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml } from "../templates/paper.ts";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function short(id: string | null): string {
  return id === null ? "—" : id.slice(0, 8);
}

function eventRow(e: DomainEvent): string {
  return `
    <tr style="border-top: 1px solid var(--rule);">
      <td class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; white-space: nowrap;">${escapeHtml(fmtTime(e.occurredAt))}</td>
      <td style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; font-family: var(--body);">${escapeHtml(e.type)}</td>
      <td class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px;">${escapeHtml(e.actor)}</td>
      <td class="micro" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; color: var(--accent);" title="${escapeHtml(e.correlationId)}">${escapeHtml(short(e.correlationId))}</td>
      <td class="micro" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; color: var(--neutral);" title="${escapeHtml(e.causationId ?? "")}">${escapeHtml(short(e.causationId))}</td>
      <td class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; font-family: var(--mono);">${escapeHtml(JSON.stringify(e.payload))}</td>
    </tr>
  `;
}

export function renderEventsPanel(ctx: PanelContext): string {
  const events = ctx.events;
  const rows = events.length === 0
    ? `<tr><td colspan="6" class="muted" style="padding: ${tokens.space.s5}px;">(no events recorded for this tenant)</td></tr>`
    : events.slice().reverse().map(eventRow).join("");

  return card(`
    <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s4}px;">
      <div>
        <h2>Events</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">raw stream · ${events.length} event${events.length === 1 ? "" : "s"} · lineage columns: corr / cause</div>
      </div>
    </header>
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="text-align:left; border-bottom: 1px solid var(--rule);">
            <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Time</th>
            <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Type</th>
            <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Actor</th>
            <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Corr</th>
            <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Cause</th>
            <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Payload</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}