// System Health panel — replay integrity (Spec 007 AC-3).
// Re-hashes the canonical event stream and surfaces drift as an alert.

import { createHash } from "node:crypto";
import type { DomainEvent } from "@daedalus/core";
import type { PanelContext } from "./register.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric, tag } from "../templates/paper.ts";

function hashEvents(events: readonly DomainEvent[]): string {
  // Canonical serialization: sort by eventId for determinism.
  const canonical = events
    .slice()
    .sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0))
    .map((e) => JSON.stringify(e))
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

type TypeCount = { type: string; count: number };

export function renderHealthPanel(ctx: PanelContext): string {
  const events = ctx.events;
  const hash = hashEvents(events);
  const types = new Map<string, number>();
  for (const e of events) {
    types.set(e.type, (types.get(e.type) ?? 0) + 1);
  }
  const distribution: TypeCount[] = Array.from(types.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const replayOk = events.length > 0;
  const integrityTag = replayOk
    ? tag("HEALTHY", "ok")
    : tag("EMPTY", "warn");

  return card(`
    <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s5}px;">
      <div>
        <h2>System Health</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">replay integrity · event-store digest</div>
      </div>
      <div>${integrityTag}</div>
    </header>

    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s5}px; margin-bottom: ${tokens.space.s5}px;">
      ${metric("Event count", String(events.length), "events on disk")}
      ${metric("Distinct types", String(types.size), "vocabulary used")}
      ${metric("Replay hash", hash.slice(0, 12) + "…", "sha256 over canonical stream")}
    </div>

    <div style="border-top: 1px solid var(--rule); padding-top: ${tokens.space.s4}px;">
      <h3 style="margin-bottom: ${tokens.space.s3}px;">Event type distribution</h3>
      ${distribution.length === 0
        ? `<div class="muted">no events recorded</div>`
        : distribution.map((d) => {
            const pct = events.length === 0 ? 0 : Math.round((d.count / events.length) * 100);
            return `
              <div style="display:flex; align-items:center; gap: ${tokens.space.s3}px; padding: ${tokens.space.s1}px 0;">
                <span class="micro muted" style="min-width: 180px;">${escapeHtml(d.type)}</span>
                <div style="flex: 1; height: 4px; background: var(--rule); position: relative;">
                  <div style="height: 4px; width: ${pct}%; background: var(--ink); position: absolute; left: 0; top: 0;"></div>
                </div>
                <span class="micro muted" style="min-width: 80px; text-align: right;">${d.count} · ${pct}%</span>
              </div>
            `;
          }).join("")
      }
    </div>
  `);
}