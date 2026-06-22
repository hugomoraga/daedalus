// Theia (Spec 012) — per-spec detail view (PR 8).

import type { ProjectState } from "../types.ts";
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./tokens.ts";

export function renderSpecDetail(slug: string, state: ProjectState): string {
  const card = state.specs.find((s) => s.slug === slug);
  if (card === undefined) {
    return renderLayout({
      title: `Spec ${slug} · Theia`,
      body: `<p>Spec <code>${escapeHtml(slug)}</code> not found.</p>
             <p><a href="/">← back to overview</a></p>`,
    });
  }
  const done = card.tasksDone + card.planDone;
  const total = card.tasksTotal + card.planTotal;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const links = [
    card.links.spec !== "" ? `<a href="https://github.com/search?q=repo%3Ahugomoraga%2Fdaedalus+path%3A${card.links.spec}">${escapeHtml(card.links.spec)}</a>` : "",
  ].join("");
  const body = `
    <section class="theia-section">
      <h2>${escapeHtml(card.title)}</h2>
      <div class="theia-mono">slug: <code>${escapeHtml(card.slug)}</code></div>
      <div class="theia-mono">status: ${escapeHtml(card.status)}${card.phase !== null ? ` · phase ${card.phase}` : ""}</div>
      <div class="theia-mono">version: ${escapeHtml(card.version ?? "?")} · last updated: ${escapeHtml(card.lastUpdated ?? "?")}</div>
      <p style="margin-top: 16px;">${escapeHtml(card.summaryPreview)}</p>
      <div style="margin-top: 16px;">
        <span class="theia-mono">${done}/${total} tasks</span>
        <span class="theia-progress"><span style="width:${pct}%"></span></span>
      </div>
      <p style="margin-top: 16px;">Spec file: ${links}</p>
      ${card.unknownReason !== null ? `<div class="theia-warn-banner">${escapeHtml(card.unknownReason)}</div>` : ""}
      <p style="margin-top: 24px;"><a href="/">← back to overview</a></p>
    </section>`;
  return renderLayout({ title: `${card.slug} · Theia`, body });
}