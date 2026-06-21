// Activity Timeline panel — events grouped by day.
// The operator sees cadence at a glance: how many events per day, what type.

import type { DomainEvent } from "@daedalus/core";
import type { PanelContext } from "./register.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml } from "../templates/paper.ts";

function dayOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function groupByDay(events: readonly DomainEvent[]): ReadonlyMap<string, DomainEvent[]> {
  const groups = new Map<string, DomainEvent[]>();
  for (const e of events) {
    const d = dayOf(e.occurredAt);
    const list = groups.get(d) ?? [];
    list.push(e);
    groups.set(d, list);
  }
  return groups;
}

export function renderActivityPanel(ctx: PanelContext): string {
  const events = ctx.events;
  const groups = groupByDay(events);
  const days = Array.from(groups.keys()).sort().reverse();

  const body = days.length === 0
    ? `<div class="muted">no activity yet for this tenant</div>`
    : days.map((day) => {
        const list = groups.get(day) ?? [];
        const items = list.slice().reverse().map((e) => `
          <li style="display:flex; gap: ${tokens.space.s4}px; padding: ${tokens.space.s1}px 0;">
            <span class="micro muted" style="min-width: 60px;">${escapeHtml(e.occurredAt.slice(11, 19))}</span>
            <span style="flex: 1;">${escapeHtml(e.type)}</span>
            <span class="micro muted">${escapeHtml(e.actor)}</span>
          </li>
        `).join("");
        return `
          <div style="margin-bottom: ${tokens.space.s5}px;">
            <div class="micro muted" style="text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: ${tokens.space.s2}px;">${escapeHtml(day)} · ${list.length} event${list.length === 1 ? "" : "s"}</div>
            <ul style="list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--rule);">${items}</ul>
          </div>
        `;
      }).join("");

  return card(`
    <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s4}px;">
      <div>
        <h2>Activity</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">grouped by day · ${events.length} event${events.length === 1 ? "" : "s"} across ${days.length} day${days.length === 1 ? "" : "s"}</div>
      </div>
    </header>
    <div>${body}</div>
  `);
}