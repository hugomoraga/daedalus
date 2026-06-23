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
      <p style="margin-top: 16px;">${inlineMarkdownToHtml(card.summaryPreview)}</p>
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

// Renders the task text with three transforms:
//   1. `inlineMarkdownToHtml` for `` `code` ``, `**bold**`, and
//      `[text](url)`.
//   2. Extract (AC-N[, AC-M, ...]) groups and render them as pills
//      appended to the end of the text. The group is removed from
//      the prose so it doesn't leave a stray empty `( )`.
//   3. Extract (plan §N) groups and render them as small muted
//      labels (`§N`) at the end of the line.
function renderTaskText(rawText: string): string {
  const acRefs: string[] = [];
  const sectionRefs: string[] = [];
  // One pass over each paren group. Inside a paren group, look for
  // both a (spec|plan) §N[-M] reference and any AC-N ids — order
  // doesn't matter. The whole paren group is consumed (replaced
  // with empty), so we never leave stray `,` or `)` behind.
  const cleaned = rawText.replace(/\(([^)]+)\)/g, (_, content: string) => {
    const sectionMatch = /(spec|plan)\s+§\s*(\S+)/.exec(content);
    if (sectionMatch) {
      const range = sectionMatch[2]
        .replace(/\s*-\s*§?/, "–")
        .replace(/[,\s]+$/, "");
      sectionRefs.push(`${sectionMatch[1]} §${range}`);
    }
    for (const acMatch of content.matchAll(/\bAC-(\d+)\b/g)) {
      acRefs.push(`AC-${acMatch[1]}`);
    }
    return "";
  });
  const normalized = cleaned.replace(/\s+/g, " ").trim();
  const html = inlineMarkdownToHtml(normalized);
  let extras = "";
  if (acRefs.length > 0) {
    const pills = acRefs.map((ac) => `<span class="theia-task-ac">${escapeHtml(ac)}</span>`).join(" ");
    extras += ` <span class="theia-task-ac-wrap">${pills}</span>`;
  }
  if (sectionRefs.length > 0) {
    const labels = sectionRefs.map((p) => `<span class="theia-section-ref">${escapeHtml(p)}</span>`).join(" ");
    extras += ` <span class="theia-section-ref-wrap">${labels}</span>`;
  }
  return `${html}${extras}`;
}

// Minimal inline-markdown → HTML converter. Handles only the three
// markers that appear in canonical spec / tasks content: `` `code` ``,
// `**bold**`, and `[text](url)`. Everything else is HTML-escaped.
//
// Three-pass with placeholders to support nesting:
//   0. Extract [text](url) → placeholders, store <a>…</a>. The
//      link text is recursively processed by this same helper so
//      backticks / bold inside the link render correctly. URLs are
//      rejected if they use a known-XSS scheme (javascript:,
//      data:, vbscript:, file:); the text is kept but the href is
//      omitted.
//   1. Extract backticked spans → placeholders, store <code>…</code>.
//   2. Extract `**…**` spans on the modified text → placeholders,
//      store <strong>…</strong>. Code placeholders inside bold
//      survive untouched.
//   3. Escape the remaining text (HTML-safe).
//   4. Restore bold placeholders → <strong>…</strong>.
//   5. Restore code placeholders → <code>…</code>.
//   6. Restore link placeholders → <a>…</a>.
//
// Unbalanced markers (a lone `` ` `` or a lone `**`, an unclosed
// `[`, etc.) are silently treated as literal text and HTML-escaped.
export function inlineMarkdownToHtml(text: string): string {
  const linkHtml: string[] = [];
  const withLinkPh = text.replace(/\[([^\]]+)\]\(([^)]+)\)\)?/g, (_, linkText: string, url: string) => {
    if (!isSafeMarkdownUrl(url)) {
      // Reject the link: keep just the text, drop the brackets +
      // parens entirely. The dangerous URL is silently discarded
      // so it can't leak into the rendered HTML.
      linkHtml.push(escapeHtml(linkText));
    } else {
      const innerHtml = inlineMarkdownToHtml(linkText);
      linkHtml.push(`<a href="${escapeHtml(url)}">${innerHtml}</a>`);
    }
    return `\u0000L${linkHtml.length - 1}\u0000`;
  });
  const codeHtml: string[] = [];
  const withCodePh = withLinkPh.replace(/`([^`]+)`/g, (_, inner: string) => {
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
  const linkRestored = codeRestored.replace(/\u0000L(\d+)\u0000/g, (_, i: string) => linkHtml[Number(i)] ?? "");
  return linkRestored;
}

// Defense-in-depth: only allow URL schemes that can't carry script.
// Allowed: http, https, mailto, and anything that looks like a path
// or fragment (relative, /, #, ../). The full href is HTML-escaped
// at the call site regardless.
function isSafeMarkdownUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  if (/^(javascript|data|vbscript|file):/.test(lower)) return false;
  return true;
}
