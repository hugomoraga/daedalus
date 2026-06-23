// Theia (Spec 012) — per-spec detail view (PR 8).

import type { ProjectState, TaskItem } from "../types.ts";
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
      ${renderTaskList(card.taskList)}
      ${card.unknownReason !== null ? `<div class="theia-warn-banner">${escapeHtml(card.unknownReason)}</div>` : ""}
      <p style="margin-top: 24px;"><a href="/">← back to overview</a></p>
    </section>`;
  return renderLayout({ title: `${card.slug} · Theia`, body });
}

// Renders the enumerated task list grouped by `## Heading` section.
// Empty list → returns "". Specs with no `##` headings get a single
// "Tasks" pseudo-section.
function renderTaskList(tasks: readonly TaskItem[]): string {
  if (tasks.length === 0) return "";
  const groups: Array<{ section: string; items: TaskItem[] }> = [];
  for (const t of tasks) {
    const section = t.section === "" ? "Tasks" : t.section;
    let group = groups.find((g) => g.section === section);
    if (group === undefined) {
      group = { section, items: [] };
      groups.push(group);
    }
    group.items.push(t);
  }
  const sections = groups.map((g) => {
    const items = g.items.map((t) => {
      const mark = t.done ? "x" : " ";
      const cls = t.done ? "theia-task-done" : "theia-task-pending";
      return `<li class="theia-mono ${cls}"><span class="theia-task-mark">[${escapeHtml(mark)}]</span> <code>${escapeHtml(t.id)}</code> ${escapeHtml(t.text)}</li>`;
    }).join("");
    return `<h3 class="theia-task-section">${escapeHtml(g.section)}</h3>
      <ul class="theia-task-list">${items}</ul>`;
  }).join("");
  return `<div class="theia-task-block">${sections}</div>`;
}