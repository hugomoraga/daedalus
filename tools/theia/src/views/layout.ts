// Theia (Spec 012) — layout primitives (PR 8).
//
// Page chrome shared by the overview and the spec detail. Uses
// Atlas's `pageStyles()` (re-exported via tokens.ts) so Theia and
// Atlas share the visual language without diverging.
//
// The CSS uses the canonical spacing scale (4/8/12/16/24/32/48/64/96)
// via inline values. The token linter enforces this.

import { pageStyles, escapeHtml } from "./tokens.ts";

export function renderLayout(opts: { title: string; body: string }): string {
  const { title, body } = opts;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${pageStyles()}
    .theia-shell { max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }
    .theia-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; }
    .theia-section { margin-bottom: 32px; }
    .theia-card { background: var(--card); border: 1px solid var(--rule); border-radius: 2px; padding: 16px; margin-bottom: 12px; }
    .theia-card-link { display: block; color: inherit; text-decoration: none; }
    .theia-card-link:hover { border-color: var(--ink); }
    .theia-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .theia-progress { display: inline-block; height: 4px; background: var(--rule); border-radius: 2px; width: 80px; vertical-align: middle; margin-left: 8px; position: relative; }
    .theia-progress > span { display: block; height: 100%; background: var(--ok); border-radius: 2px; }
    .theia-mono { font-family: var(--mono); font-size: 12px; color: var(--neutral); }
    .theia-warn-banner { background: var(--warn); color: var(--paper); padding: 8px 12px; border-radius: 2px; margin-bottom: 16px; font-family: var(--mono); font-size: 12px; }
    .theia-fail-banner { background: var(--alert); color: var(--paper); padding: 8px 12px; border-radius: 2px; margin-bottom: 16px; font-family: var(--mono); font-size: 12px; }
    h4 { font-size: 13px; color: var(--neutral); margin-top: 16px; margin-bottom: 8px; }
    .theia-phase-cell {
      --phase-bg: var(--card);
      --phase-fg: var(--ink);
      --phase-border: var(--rule);
      display: block; color: var(--phase-fg); text-decoration: none;
      background: var(--phase-bg);
      border: 1px solid var(--phase-border);
      border-radius: 2px; padding: 8px; flex: 1; min-width: 80px;
      font-family: var(--mono); font-size: 12px; text-align: center;
    }
    .theia-phase-cell:hover { --phase-border: var(--ink); }
    .theia-phase-cell.is-active { --phase-bg: var(--accent); --phase-fg: var(--paper); }
    .theia-phase-cell.is-empty { --phase-bg: transparent; border-style: dashed; }
    .theia-task-block { margin-top: 24px; }
    .theia-task-section { margin-top: 16px; margin-bottom: 8px; }
    .theia-task-list { list-style: none; padding: 0; margin: 0; }
    .theia-task { padding: 8px 0; border-bottom: 1px solid var(--rule); }
    .theia-task:last-child { border-bottom: none; }
    .theia-task-line1 { font-family: var(--mono); font-size: 12px; }
    .theia-task-text { margin-left: 24px; margin-top: 4px; }
    .theia-task-mark { display: inline-block; width: 24px; color: var(--neutral); }
    .theia-task-done { color: var(--neutral); }
    .theia-task-done .theia-task-line1 code { text-decoration: line-through; }
    .theia-task-done .theia-task-mark { color: var(--ok); }
    .theia-task-pending .theia-task-mark { color: var(--neutral); }
    .theia-task-ac {
      display: inline-block; font-family: var(--mono); font-size: 11px;
      color: var(--neutral); background: var(--rule);
      padding: 4px 8px; border-radius: 2px; margin-left: 4px;
      text-decoration: none;
    }
    .theia-task-ac-wrap { margin-left: 4px; }
    .theia-section-ref {
      display: inline-block; font-family: var(--mono); font-size: 11px;
      color: var(--neutral); margin-left: 4px;
      text-decoration: none;
    }
    .theia-section-ref-wrap { margin-left: 4px; }
    /* UX-008 P2-1: the .brand wordmark + subtitle had no CSS so
       "Theia" inherited the body font and had no visual identity.
       The wordmark uses the display trio at 18px with a tighter
       letter-spacing; the <small> subtitle is muted + 12px so it
       reads as a label, not a sibling word. */
    .brand {
      font-family: var(--display);
      font-size: 18px;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .brand small {
      color: var(--neutral);
      font-size: 12px;
      font-family: var(--body);
      letter-spacing: 0;
      margin-left: 8px;
    }

    /* UX-008 P3-1 — hover transitions (150–300ms ease). Atlas
       interactive elements snap to a new border-color on hover
       with no transition. Smooth transitions make the page feel
       calmer without changing the final state. Token-disciplined:
       only color / border-color / background-color / box-shadow —
       no width/height/margin shifts. */
    a, .theia-card-link, .theia-phase-cell, .theia-task-ac, .theia-section-ref, .navigate-card {
      transition: color 200ms ease, border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
    }

    /* UX-008 P3-2 — keyboard navigation focus visible. Browser
       defaults vary; without an explicit rule, keyboard users on
       some browsers get no visible focus indicator on links.
       :focus-visible (not :focus) so mouse clicks don't paint the
       ring. Outline + offset keeps the ring inside the layout
       box. */
    a:focus-visible, button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* UX-008 P3-3 — respect prefers-reduced-motion. Theia itself
       has no animations today, but layout.ts is the shared shell
       (the Navigate marquee lives here when Atlas-style panels
       are embedded). Future-proof: stop every animation + collapse
       every transition when the user has asked for less motion. */
    @media (prefers-reduced-motion: reduce) {
      .navigate-track { animation-play-state: paused !important; }
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }

    /* UX-009 — Backlog section. The 4-px-tall padding on every
       row made the section heavy (13 historical done rows × ~3
       visible lines = 40+ lines of table before the working
       states). New token-disciplined rules: rows sit on hairline
       rules (the canonical card-grid pattern from the spec cards),
       the title cell gets a bit more breathing room, and the
       collapsed done group carries its own affordance. */
    .theia-backlog-table {
      width: 100%;
      border-collapse: collapse;
    }
    .theia-backlog-row td {
      padding: 8px 12px;
      vertical-align: top;
    }
    .theia-backlog-row + .theia-backlog-row td {
      border-top: 1px solid var(--rule);
    }
    .theia-backlog-id { white-space: nowrap; }
    .theia-backlog-kind { white-space: nowrap; }
    .theia-backlog-cell { line-height: 1.5; }
    .theia-backlog-affects { margin-top: 4px; }
    .theia-backlog-body { margin-top: 4px; }
    .theia-backlog-body-inner { margin-top: 4px; }
    /* UX-011 — typography hierarchy. The body content uses the
       canonical typography trio (Atlas AC-11) and the canonical
       spacing scale. Headings get display font + 16/8 margins;
       paragraphs get body font + 8px margin; the horizontal rule
       is a single hairline. Same rule set works for any prose
       surface that uses inlineMarkdownToHtml. */
    .theia-backlog-body-inner {
      font-family: var(--body);
      font-size: 14px;
      line-height: 1.5;
      color: var(--ink);
    }
    .theia-backlog-body-inner > :first-child { margin-top: 0; }
    .theia-backlog-body-inner > :last-child { margin-bottom: 0; }
    .theia-backlog-body-inner h1,
    .theia-backlog-body-inner h2,
    .theia-backlog-body-inner h3,
    .theia-backlog-body-inner h4,
    .theia-backlog-body-inner h5,
    .theia-backlog-body-inner h6 {
      font-family: var(--display);
      font-weight: 500;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .theia-backlog-body-inner .theia-md-h1 { font-size: 24px; letter-spacing: -0.02em; }
    .theia-backlog-body-inner .theia-md-h2 { font-size: 20px; letter-spacing: -0.02em; }
    .theia-backlog-body-inner .theia-md-h3 { font-size: 16px; }
    .theia-backlog-body-inner .theia-md-h4 { font-size: 14px; }
    .theia-backlog-body-inner .theia-md-h5 { font-size: 13px; color: var(--neutral); }
    .theia-backlog-body-inner .theia-md-h6 { font-size: 12px; color: var(--neutral); }
    .theia-backlog-body-inner p.theia-md-p { margin: 8px 0; }
    .theia-backlog-body-inner hr.theia-md-hr {
      margin: 16px 0;
      border: none;
      border-top: 1px solid var(--rule);
    }
    .theia-backlog-body-inner pre.theia-code-block {
      margin: 8px 0;
      padding: 8px 12px;
      background: var(--card);
      border-left: 2px solid var(--neutral);
      font-size: 12px;
      overflow-x: auto;
    }
    .theia-backlog-body-inner code {
      font-family: var(--mono);
      font-size: 12px;
    }
    .theia-backlog-body-inner ul,
    .theia-backlog-body-inner ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    .theia-backlog-body-inner li { margin: 4px 0; }
    .theia-backlog-body-inner table.theia-md-table {
      margin: 8px 0;
      border-collapse: collapse;
      width: auto;
    }
    .theia-backlog-body-inner .theia-md-th-left,
    .theia-backlog-body-inner .theia-md-td-left { text-align: left; }
    .theia-backlog-body-inner .theia-md-th-center,
    .theia-backlog-body-inner .theia-md-td-center { text-align: center; }
    .theia-backlog-body-inner .theia-md-th-right,
    .theia-backlog-body-inner .theia-md-td-right { text-align: right; }
    .theia-backlog-body-inner .theia-md-table th,
    .theia-backlog-body-inner .theia-md-table td {
      padding: 4px 8px;
      border-bottom: 1px solid var(--rule);
      font-size: 12px;
    }
    .theia-backlog-group-head { margin-top: 16px; margin-bottom: 8px; }
    .theia-backlog-done { margin-top: 16px; }
    .theia-backlog-done > summary {
      cursor: pointer;
      list-style: none;
      padding: 4px 0;
    }
    .theia-backlog-done > summary::-webkit-details-marker { display: none; }
    .theia-backlog-done > summary::before {
      content: "▸ ";
      color: var(--neutral);
    }
    .theia-backlog-done[open] > summary::before { content: "▾ "; }
    .theia-backlog-done-summary {
      font-family: var(--display);
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--neutral);
      font-weight: 500;
    }

    /* UX-010 — card list (replaces the UX-009 table). Each
       entry is a <li> with three lines:
         1. theia-backlog-head   : badges + title (inline)
         2. theia-backlog-affects: mono line, optional
         3. theia-backlog-body   : <details> with the body
       The list has no bullets; items are separated by hairline
       rules. This matches the spec-card pattern visually and
       keeps each entry to a fixed 2-3-line visible footprint
       (was 3-5 lines in the table layout, with the badges
       visually orphaned in the leftmost column). */
    .theia-backlog-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .theia-backlog-item {
      padding: 12px 0;
      border-top: 1px solid var(--rule);
    }
    .theia-backlog-list > .theia-backlog-item:first-child {
      border-top: none;
    }
    .theia-backlog-head {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }
    .theia-backlog-head strong { font-weight: 500; }
    .theia-backlog-affects { margin-top: 4px; }
    .theia-backlog-affects code {
      font-family: var(--mono);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="theia-shell">
    <div class="theia-header">
      <div class="brand">Theia<small>repo state visualizer</small></div>
      <div class="theia-mono">${escapeHtml(title)}</div>
    </div>
    ${body}
  </div>
</body>
</html>`;
}