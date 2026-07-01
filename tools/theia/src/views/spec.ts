// Theia (Spec 012) — per-spec detail view (PR 8).
//
// Extended by UX-003 to enumerate the spec's tasks grouped by
// `## Heading` section, and by UX-006 to render each task in a
// scannable two-line block with inline code, bold, and AC pills.

import type { ProjectState, TaskItem } from "../types.ts";
import { renderLayout } from "./layout.ts";
import { escapeHtml, GITHUB_REPO } from "./tokens.ts";

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
  // The spec's links.spec is a path relative to the repo root
  // (e.g. "specs/012-theia/spec.md"). Render it as a direct GitHub
  // blob URL, not a search URL — UX-008.
  const specPath = card.links.spec !== ""
    ? `<a href="https://github.com/${GITHUB_REPO}/blob/main/${card.links.spec}">${escapeHtml(card.links.spec)}</a>`
    : "";
  // UX-008 P1-4: when a spec is fully done, render a one-line summary
  // right under the progress bar so the founder doesn't have to scroll
  // through N identical [x] tasks to learn what they need to know:
  //   "8 PRs · 32/32 tasks done · Ratified Phase 2 · v1.0.0"
  // The count label adapts: if every section starts with "PR " (the
  // Spec 015 convention), say "PRs"; otherwise say "sections" (some
  // specs use `## 1.`, `## 2.` numeric headings — Spec 015 itself is
  // the canonical example since it's the spec that defines the
  // convention, not an instance of it).
  const sections = new Set(card.taskList.map((t) => t.section));
  const allPrSections = sections.size > 0 && [...sections].every((s) => /^PR \d+/.test(s));
  const sectionCount = sections.size;
  const sectionLabel = allPrSections
    ? `PR${sectionCount === 1 ? "" : "s"}`
    : `section${sectionCount === 1 ? "" : "s"}`;
  const isFullyDone = total > 0 && done === total;
  const summaryLine = isFullyDone
    ? `<div class="theia-mono" style="margin-top: 8px;">${sectionCount} ${sectionLabel} · ${done}/${total} tasks done · ${escapeHtml(card.status)}${card.phase !== null ? ` Phase ${card.phase}` : ""} · v${escapeHtml(card.version ?? "?")}</div>`
    : "";
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
      ${summaryLine}
      <p style="margin-top: 16px;">Spec file: ${specPath}</p>
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

// Markdown → HTML converter for spec summaries, task text, and
// backlog bodies. Handles block-level markers first (fenced code
// blocks, GFM tables, bullet/numbered lists) and then the inline
// markers from UX-007 (`` `code` ``, `**bold**`, `[text](url)`).
// Everything else is HTML-escaped.
//
// Pipeline (each step is a pure transform that returns a string):
//
//   0. Fenced code blocks: ```` ```...``` ```` → placeholders,
//      stored as `<pre><code class="theia-code-block">…</code></pre>`.
//      The content of the block is HTML-escaped but NOT processed
//      for inline markdown (the whole point of a code block).
//   1. Tables: GFM pipe-tables (header | sep | rows) → placeholders,
//      stored as `<table class="theia-md-table">`. Cells run through
//      the inline passes (so **bold** and `code` inside a cell work).
//   2. Lists: lines that start with `- `, `* `, or `\d+. ` → placeholders,
//      stored as `<ul>` or `<ol>`. Inline passes run per item.
//   3. Links: [text](url) → placeholders, stored as `<a href>`.
//      URL safety guard (no javascript:/data:/vbscript:/file:).
//   4. Inline code: `…` → placeholders, stored as `<code>`.
//   5. Bold: **…** → placeholders, stored as `<strong>`.
//   6. HTML-escape the remaining text.
//   7-10. Restore placeholders in reverse order.
//
// Unbalanced markers (a lone `` ` `` or `**`, an unclosed `[`, an
// unclosed ```` ``` ```` fence) are silently treated as literal text
// and HTML-escaped. This is the same policy the inline passes
// already followed; the block passes inherit it.
export function inlineMarkdownToHtml(text: string, opts: { wrapParagraphs?: boolean } = {}): string {
  // Block-level pre-passes operate on the raw text. They each
  // extract their target structure into a placeholder, leaving the
  // rest of the text untouched for the next pass to handle.
  const fenceHtml: string[] = [];
  let work = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang: string, body: string) => {
    // lang is the optional language hint; we drop it (the token
    // linter would reject per-language class names). Indentation
    // inside the block is preserved as-is so the rendered <pre>
    // looks like the source.
    const escaped = escapeHtml(body.replace(/\n$/, ""));
    fenceHtml.push(`<pre class="theia-code-block"><code>${escaped}</code></pre>`);
    return `\u0000F${fenceHtml.length - 1}\u0000`;
  });

  const tableHtml: string[] = [];
  work = work.replace(/(^|\n)((?:\|[^\n]*\n)+)(\|[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*\n)((?:\|[^\n]*\n?)+)/g,
    (_, lead: string, headerBlock: string, sepLine: string, bodyBlock: string) => {
      const table = renderTable(headerBlock, sepLine, bodyBlock);
      tableHtml.push(table);
      const ph = `${lead}\u0000T${tableHtml.length - 1}\u0000`;
      return ph;
    });

  const listHtml: string[] = [];
  work = work.replace(/(^|\n)((?:[ ]{0,6}(?:[-*]|\d+\.)[ \t]+[^\n]+\n?)+)/g,
    (_, lead: string, block: string) => {
      const list = renderList(block);
      listHtml.push(list);
      return `${lead}\u0000I${listHtml.length - 1}\u0000`;
    });

  // UX-011 — ATX headers. `^(#{1,6})\s+(.+)$` (1 to 6 hashes,
  // then whitespace, then text). The line must START with the
  // hash — no leading whitespace (otherwise it's an indented
  // code block in CommonMark, which we don't handle). The text
  // is captured up to end-of-line; trailing whitespace is
  // trimmed. Trailing `#` (setext-style close) is NOT supported
  // — most modern markdown authors use the ATX form.
  const headerHtml: string[] = [];
  work = work.replace(/^(#{1,6})\s+(.+?)\s*$/gm, (_, hashes: string, headerText: string) => {
    const level = hashes.length;
    headerHtml.push(`<h${level} class="theia-md-h${level}">${inlineMarkdownToHtml(headerText, { wrapParagraphs: false })}</h${level}>`);
    return `\u0000H${headerHtml.length - 1}\u0000`;
  });

  // UX-011 — horizontal rules. `^---+\s*$` (3 or more dashes
  // on a line by themselves, with optional trailing whitespace).
  // Must NOT match `----foo` (some inline text follows), which
  // we enforce by requiring only whitespace after the dashes.
  const hrHtml: string[] = [];
  work = work.replace(/^---+\s*$/gm, () => {
    hrHtml.push(`<hr class="theia-md-hr">`);
    return `\u0000R${hrHtml.length - 1}\u0000`;
  });

  // Inline passes (UX-007). Run BEFORE the paragraph pass so
  // that backticks / bold / links inside paragraphs get
  // placeholders that survive the wrap (UX-011). Block-level
  // placeholders (F/T/I/H/R) stay on their own lines and the
  // paragraph pass treats them as block boundaries.
  const linkHtml: string[] = [];
  const withLinkPh = work.replace(/\[([^\]]+)\]\(([^)]+)\)\)?/g, (_, linkText: string, url: string) => {
    if (!isSafeMarkdownUrl(url)) {
      linkHtml.push(escapeHtml(linkText));
    } else {
      const innerHtml = inlineMarkdownToHtml(linkText, { wrapParagraphs: false });
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

  // UX-011 — paragraphs. Run AFTER the inline passes so the
  // paragraph content already has inline placeholders. The
  // prose between consecutive non-blank lines is joined with a
  // single space and wrapped in `<p class="theia-md-p">…</p>`.
  // Lines containing a block-level placeholder (F/T/I/H/R) are
  // emitted standalone, not folded into a paragraph.
  //
  // The recursive calls below (link text, table cells, header
  // text) pass `{ wrapParagraphs: false }` so they don't double-
  // wrap inline content in `<p>`. Only the top-level call wraps.
  const paraHtml: string[] = [];
  let withParaPh = withBoldPh;
  if (opts.wrapParagraphs !== false) {
    withParaPh = wrapParagraphs(withBoldPh, paraHtml);
  }
  work = withParaPh;
  const escaped = escapeHtml(work);
  // Restoration order:
  //   1. Inline placeholders (B/C/L) — first, so any inline
  //      placeholders that survive the work string (top-level
  //      prose between block placeholders) are replaced. Inline
  //      placeholders that live INSIDE the paragraph HTML
  //      (paraHtml[]) are NOT yet replaced; they survive step 3.
  //   2. Block-level placeholders (F/T/I/H/R) — top-level
  //      fences, tables, lists, headers, and rules.
  //   3. Paragraph placeholders (P) — the `<p>…</p>` HTML is
  //      substituted; the prose inside may contain inline
  //      placeholders that survived step 1.
  //   4. Inline placeholders AGAIN — catches the ones inside
  //      paragraph HTML that were emitted by step 3.
  const boldPass1 = escaped.replace(/\u0000B(\d+)\u0000/g, (_, i: string) => boldHtml[Number(i)] ?? "");
  const codePass1 = boldPass1.replace(/\u0000C(\d+)\u0000/g, (_, i: string) => codeHtml[Number(i)] ?? "");
  const linkPass1 = codePass1.replace(/\u0000L(\d+)\u0000/g, (_, i: string) => linkHtml[Number(i)] ?? "");
  const blocks = linkPass1
    .replace(/\u0000F(\d+)\u0000/g, (_, i: string) => fenceHtml[Number(i)] ?? "")
    .replace(/\u0000T(\d+)\u0000/g, (_, i: string) => tableHtml[Number(i)] ?? "")
    .replace(/\u0000I(\d+)\u0000/g, (_, i: string) => listHtml[Number(i)] ?? "")
    .replace(/\u0000H(\d+)\u0000/g, (_, i: string) => headerHtml[Number(i)] ?? "")
    .replace(/\u0000R(\d+)\u0000/g, (_, i: string) => hrHtml[Number(i)] ?? "");
  const withParagraphs = blocks.replace(/\u0000P(\d+)\u0000/g, (_, i: string) => paraHtml[Number(i)] ?? "");
  // Inline pass 2: the paragraph HTML emitted above contains
  // inline placeholders that need to be replaced now.
  const boldPass2 = withParagraphs.replace(/\u0000B(\d+)\u0000/g, (_, i: string) => boldHtml[Number(i)] ?? "");
  const codePass2 = boldPass2.replace(/\u0000C(\d+)\u0000/g, (_, i: string) => codeHtml[Number(i)] ?? "");
  const linkPass2 = codePass2.replace(/\u0000L(\d+)\u0000/g, (_, i: string) => linkHtml[Number(i)] ?? "");
  return linkPass2;
}

// UX-011 — wrap runs of consecutive non-blank prose lines in
  // `<p class="theia-md-p">`. Lines containing a block-level
  // placeholder (F/T/I/H/R) are emitted standalone, not folded
  // into a paragraph. Prose on the same line as a placeholder
  // is preserved: lines like "intro text\n\u0000F0\u0000\nmore
  // text" become `<p>intro text</p>\n\u0000F0\u0000\n<p>more
  // text</p>`.
//
// Lines inside a paragraph are joined with a single space.
// This matches how prose is read on the web: a paragraph is
  // one visual block, no surprise mid-line breaks.
const BLOCK_PLACEHOLDER_RE = /\u0000[FTIHR]/;

function wrapParagraphs(text: string, paraSink: string[]): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  const flush = (): void => {
    if (buf.length === 0) return;
    const joined = buf.join(" ").trim();
    if (joined.length > 0) {
      // The escaped prose is what ends up between the <p> tags.
      // The wrapping `<p>…</p>` itself is restored at the end of
      // the pipeline (placeholders are not re-escaped, only the
      // prose inside the paragraph is).
      paraSink.push(`<p class="theia-md-p">${escapeHtml(joined)}</p>`);
      out.push(`\u0000P${paraSink.length - 1}\u0000`);
    }
    buf = [];
  };
  for (const line of lines) {
    if (line.trim() === "") {
      // Blank lines are paragraph boundaries. Flush any prose
      // buffer; the next line (whether a placeholder or prose)
      // starts a fresh block. No need to emit a literal blank
      // — the placeholders are already separated by their own
      // content.
      flush();
      continue;
    }
    // A line that is ONLY a placeholder (or only whitespace +
    // a placeholder) is a standalone block; flush any prose
    // buffer first.
    if (BLOCK_PLACEHOLDER_RE.test(line) && line.replace(/[\s\d]/g, "").replace(/\u0000[FTIHR]\d*\u0000/g, "") === "") {
      flush();
      out.push(line);
      continue;
    }
    // Mixed lines (prose + placeholder) get the prose folded
    // into a paragraph and the placeholder emitted standalone
    // on its own line. The placeholder line in our pipeline is
    // always alone (other passes put each placeholder on its
    // own line), so this branch is rarely hit — kept for
    // robustness against future passes.
    if (BLOCK_PLACEHOLDER_RE.test(line)) {
      flush();
      // The line may have prose before + after the placeholder;
      // split it on the placeholder boundary. The current
      // pipeline never produces such mixed lines, so we just
      // emit the line verbatim.
      out.push(line);
      continue;
    }
    buf.push(line);
  }
  flush();
  return out.join("\n");
}

// Render a GFM pipe-table from the three captured blocks. Each
// cell runs through inlineMarkdownToHtml so **bold** and `code`
// inside a cell work. Alignment from the separator row is emitted
// as a CSS class on the cells (token-disciplined: no inline
// styles).
function renderTable(headerBlock: string, sepLine: string, bodyBlock: string): string {
  const headerCells = splitRow(headerBlock);
  const alignCells = parseAlignment(sepLine);
  const thead = "<thead><tr>"
    + headerCells.map((c, i) => {
      const a = alignCells[i] ?? "left";
      return `<th class="theia-md-th-${a}">${inlineMarkdownToHtml(c, { wrapParagraphs: false })}</th>`;
    }).join("")
    + "</tr></thead>";
  const rows = bodyBlock.trimEnd().split("\n").map((row) => {
    if (row.trim() === "") return "";
    const cells = splitRow(row);
    return "<tr>"
      + cells.map((c, i) => {
        const a = alignCells[i] ?? "left";
        return `<td class="theia-md-td-${a}">${inlineMarkdownToHtml(c, { wrapParagraphs: false })}</td>`;
      }).join("")
      + "</tr>";
  }).join("");
  return `<table class="theia-md-table">${thead}<tbody>${rows}</tbody></table>`;
}

function splitRow(line: string): string[] {
  // A row looks like '| a | b | c |'. We split on '|' and trim each
  // cell. The leading and trailing empty cells (from the |'s at the
  // row edges) are dropped.
  const trimmed = line.replace(/^\n|\n$/g, "");
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const inner2 = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return inner2.split("|").map((c) => c.trim());
}

function parseAlignment(sepLine: string): Array<"left" | "center" | "right"> {
  const cells = splitRow(sepLine);
  return cells.map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center" as const;
    if (right) return "right" as const;
    return "left" as const;
  });
}

// Render a list block (a run of consecutive list-item lines,
// optionally indented) as nested <ul>/<ol> with inline-marker
// processing per item. Two-space indent per nesting level, up to
// three levels deep.
//
// We track an explicit "open list stack" of {indent, ordered}
// pairs. When the next item is at a higher indent than the
// current stack top, we open a new list inside the previous
// item. When the next item is at a lower indent, we close lists
// until the stack top matches (or is below) the new indent.
function renderList(block: string): string {
  const lines = block.split("\n");
  // Drop the trailing empty line (the regex match always leaves
  // one) so we don't render an empty list.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const items: Array<{ indent: number; ordered: boolean; text: string }> = [];
  for (const line of lines) {
    const m = /^([ ]{0,6})([-*]|\d+\.)[ \t]+(.*)$/.exec(line);
    if (m === null) continue;
    const indent = m[1]!.length;
    const marker = m[2]!;
    const ordered = /\d+\./.test(marker);
    items.push({ indent, ordered, text: m[3]! });
  }
  if (items.length === 0) return "";
  const out: string[] = [];
  const stack: Array<{ indent: number; ordered: boolean }> = [];
  for (const it of items) {
    // Pop while the stack top has an indent STRICTLY GREATER than
    // the current item's indent (we're stepping out to a less-
    // indented level). Equal indent means the new item is a
    // sibling — we keep the list open.
    while (stack.length > 0 && stack[stack.length - 1]!.indent > it.indent) {
      const top = stack.pop()!;
      out.push(`</${top.ordered ? "ol" : "ul"}>`);
    }
    // If the new indent is greater than the current stack top
    // (or stack is empty), we open a new list. For a sibling at
    // the same indent, the existing list is reused.
    if (stack.length === 0 || stack[stack.length - 1]!.indent < it.indent) {
      out.push(`<${it.ordered ? "ol" : "ul"}>`);
      stack.push({ indent: it.indent, ordered: it.ordered });
    }
    out.push(`<li>${inlineMarkdownToHtml(it.text, { wrapParagraphs: false })}</li>`);
  }
  // Close any still-open lists.
  while (stack.length > 0) {
    const top = stack.pop()!;
    out.push(`</${top.ordered ? "ol" : "ul"}>`);
  }
  return out.join("");
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
