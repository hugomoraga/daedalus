// Recent Logs panel — last N events, dense, no grouping.
// Designed for the "show me what just happened" scan.

import type { DomainEvent } from "@daedalus/core";
import type { PanelContext } from "./register.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml } from "../templates/paper.ts";

const RECENT_LIMIT = 50;

export function renderLogsPanel(ctx: PanelContext): string {
  const events = ctx.events;
  const recent = events.slice(-RECENT_LIMIT).reverse();
  const lines = recent.length === 0
    ? `<div class="muted">(no recent logs)</div>`
    : recent.map((e) => `
      <div style="display:flex; gap: ${tokens.space.s4}px; padding: ${tokens.space.s1}px 0; border-top: 1px solid var(--rule); font-family: var(--mono); font-size: 12px;">
        <span class="muted" style="min-width: 130px;">${escapeHtml(e.occurredAt)}</span>
        <span style="min-width: 220px;">${escapeHtml(e.type)}</span>
        <span class="muted" style="min-width: 80px;">${escapeHtml(e.actor)}</span>
        <span class="muted" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(JSON.stringify(e.payload))}</span>
      </div>
    `).join("");

  return card(`
    <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s4}px;">
      <div>
        <h2>Recent Logs</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">last ${RECENT_LIMIT} · ${events.length} total in stream</div>
      </div>
    </header>
    <div>${lines}</div>
  `);
}