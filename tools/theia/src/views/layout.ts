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
    .theia-task-block { margin-top: 24px; }
    .theia-task-section { margin-top: 16px; margin-bottom: 8px; }
    .theia-task-list { list-style: none; padding: 0; margin: 0; }
    .theia-task-list li { padding: 4px 0; }
    .theia-task-mark { display: inline-block; width: 24px; color: var(--neutral); }
    .theia-task-done .theia-task-mark { color: var(--ok); }
    .theia-task-done { color: var(--neutral); }
    .theia-task-done code, .theia-task-done .theia-task-mark + code { text-decoration: line-through; }
    .theia-task-pending .theia-task-mark { color: var(--neutral); }
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