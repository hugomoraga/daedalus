// Theia (Spec 012) — per-spec detail view (PR 8).
//
// Extended by UX-003 to enumerate the spec's tasks grouped by
// `## Heading` section, and by UX-006 to render each task in a
// scannable two-line block with inline code, bold, and AC pills.

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
      const text = renderTaskText(t.text);
      return `<li class="theia-task ${cls}">
        <div class="theia-task-line1">
          <span class="theia-task-mark">[${escapeHtml(mark)}]</span>
          <code>${escapeHtml(t.id)}</code>
        </div>
        <div class="theia-task-text">${text}</div>
      </li>`;
    }).join("");
    return `<h3 class="theia-task-section">${escapeHtml(g.section)}</h3>
      <ul class="theia-task-list">${items}</ul>`;
  }).join("");
  return `<div class="theia-task-block">${sections}</div>`;
}

// Renders the task text with two transforms:
//   1. `inlineMarkdownToHtml` for `` `code` `` and `**bold**`.
//   2. Extract (AC-N[, AC-M, ...]) groups and render them as pills
//      appended to the end of the text. The group is removed from
//      the prose so it doesn't leave a stray empty `( )`.
function renderTaskText(rawText: string): string {
  const acRefs: string[] = [];
  const cleaned = rawText.replace(
    /\(AC-(\d+(?:,\s*AC-\d+)*)\)/g,
    (_, list: string) => {
      for (const id of list.split(",")) {
        const trimmed = id.trim();
        if (trimmed.startsWith("AC-")) {
          acRefs.push(trimmed);
        } else {
          acRefs.push(`AC-${trimmed}`);
        }
      }
      return "";
    },
  );
  const normalized = cleaned.replace(/\s+/g, " ").trim();
  const html = inlineMarkdownToHtml(normalized);
  if (acRefs.length === 0) return html;
  const pills = acRefs.map((ac) => `<span class="theia-task-ac">${escapeHtml(ac)}</span>`).join(" ");
  return `${html} <span class="theia-task-ac-wrap">${pills}</span>`;
}

// Minimal inline-markdown → HTML converter. Handles only the two
// markers that appear in canonical tasks.md: `` `code` `` and
// `**bold**`. Everything else is HTML-escaped.
//
// Two-pass with placeholders to support nesting:
//   1. Extract backticked spans → placeholders, store <code>…</code>.
//   2. Extract `**…**` spans on the modified text → placeholders,
//      store <strong>…</strong>. Code placeholders inside bold
//      survive untouched.
//   3. Escape the remaining text (HTML-safe).
//   4. Restore bold placeholders → <strong>…</strong>.
//   5. Restore code placeholders → <code>…</code>.
//
// Unbalanced markers (a lone `` ` `` or a lone `**`) are silently
// treated as literal text and HTML-escaped.
export function inlineMarkdownToHtml(text: string): string {
  const codeHtml: string[] = [];
  const withCodePh = text.replace(/`([^`]+)`/g, (_, inner: string) => {
    const ph = `\u0000C${codeHtml.length}\u0000`;
    codeHtml.push(`<code>${escapeHtml(inner)}</code>`);
    return ph;
  });
  const boldHtml: string[] = [];
  const withBoldPh = withCodePh.replace(/\*\*([^*]+)\*\*/g, (_, inner: string) => {
    const ph = `\u0000B${boldHtml.length}\u0000`;
    boldHtml.push(`<strong>${escapeHtml(inner)}</strong>`);
    return ph;
  });
  const escaped = escapeHtml(withBoldPh);
  const boldRestored = escaped.replace(/\u0000B(\d+)\u0000/g, (_, i: string) => boldHtml[Number(i)] ?? "");
  const codeRestored = boldRestored.replace(/\u0000C(\d+)\u0000/g, (_, i: string) => codeHtml[Number(i)] ?? "");
  return codeRestored;
}
