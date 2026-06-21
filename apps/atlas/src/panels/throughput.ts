// Throughput panel — events-per-day, hand-authored SVG (no charts library).
// Spec 007 §9: hand-authored SVG, no D3 / Chart.js / Recharts.

import type { DomainEvent } from "@daedalus/core";
import type { PanelContext } from "./register.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, microLabel } from "../templates/paper.ts";

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

type DayBucket = { day: string; total: number; byType: Map<string, number> };

function bucketByDay(events: readonly DomainEvent[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const e of events) {
    const day = dayOf(e.occurredAt);
    let b = map.get(day);
    if (b === undefined) {
      b = { day, total: 0, byType: new Map() };
      map.set(day, b);
    }
    b.total += 1;
    b.byType.set(e.type, (b.byType.get(e.type) ?? 0) + 1);
  }
  return Array.from(map.values()).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

const BAR_W = 32;
const BAR_GAP = 8;
const CHART_H = 96;
const LABEL_H = 32;

export function renderThroughputPanel(ctx: PanelContext): string {
  const buckets = bucketByDay(ctx.events);
  const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);

  if (buckets.length === 0) {
    return card(`
      <header style="margin-bottom: ${tokens.space.s4}px;">
        <h2>Throughput</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">${microLabel("WIN", "DAILY")} · events per day</div>
      </header>
      <div class="muted">no events yet — bars will appear as soon as the tenant emits its first event</div>
    `);
  }

  const chartW = buckets.length * (BAR_W + BAR_GAP);
  const bars = buckets.map((b, i) => {
    const h = max === 0 ? 0 : Math.round((b.total / max) * CHART_H);
    const x = i * (BAR_W + BAR_GAP);
    const y = CHART_H - h;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" fill="var(--ink)" />
        <text x="${x + BAR_W / 2}" y="${CHART_H + 12}" text-anchor="middle" class="micro muted" font-size="10">${escapeHtml(b.day.slice(5))}</text>
        <text x="${x + BAR_W / 2}" y="${y - 4}" text-anchor="middle" class="micro" font-size="11" fill="var(--ink)">${b.total}</text>
      </g>
    `;
  }).join("");

  const table = buckets.slice().reverse().slice(0, 14).map((b) => {
    const top = Array.from(b.byType.entries()).sort((a, c) => c[1] - a[1]).slice(0, 3);
    return `
      <tr style="border-top: 1px solid var(--rule);">
        <td class="micro" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px;">${escapeHtml(b.day)}</td>
        <td style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; font-family: var(--display); font-size: 18px;">${b.total}</td>
        <td class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px;">${top.map(([t, n]) => `${escapeHtml(t)} (${n})`).join(" · ")}</td>
      </tr>
    `;
  }).join("");

  return card(`
    <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s4}px;">
      <div>
        <h2>Throughput</h2>
        <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">events per day · last ${buckets.length} day${buckets.length === 1 ? "" : "s"} · peak ${max}/day</div>
      </div>
    </header>

    <div style="overflow-x: auto; margin-bottom: ${tokens.space.s5}px;">
      <svg viewBox="0 0 ${chartW} ${CHART_H + LABEL_H}" width="${chartW}" height="${CHART_H + LABEL_H}" style="display:block;">
        ${bars}
      </svg>
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="text-align: left; border-bottom: 1px solid var(--rule);">
          <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Day</th>
          <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Count</th>
          <th class="micro muted" style="padding: ${tokens.space.s2}px ${tokens.space.s3}px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;">Top types</th>
        </tr>
      </thead>
      <tbody>${table}</tbody>
    </table>
  `);
}