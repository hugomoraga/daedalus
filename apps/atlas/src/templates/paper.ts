// HTML primitives for paper-like composition.
// Spec 007 §1: editorial layout, hairline rules, generous whitespace.

import { tokens } from "../tokens.ts";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function pageStyles(): string {
  return `
    :root {
      --paper: ${tokens.color.paper};
      --card: ${tokens.color.card};
      --ink: ${tokens.color.ink};
      --neutral: ${tokens.color.neutral};
      --accent: ${tokens.color.accent};
      --rule: ${tokens.color.rule};
      --ok: ${tokens.color.ok};
      --warn: ${tokens.color.warn};
      --alert: ${tokens.color.alert};
      --display: ${tokens.type.display};
      --body: ${tokens.type.body};
      --mono: ${tokens.type.mono};
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--body);
      font-size: 15px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--rule); }
    a:hover { border-bottom-color: var(--accent); }
    h1, h2, h3, h4 { font-family: var(--display); font-weight: 500; letter-spacing: -0.01em; margin: 0; }
    h1 { font-size: 28px; line-height: 1.2; }
    h2 { font-size: 18px; line-height: 1.3; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--neutral); font-weight: 500; }
    .mono { font-family: var(--mono); }
    .muted { color: var(--neutral); }
    .rule { border-top: 1px solid var(--rule); }
    code, .micro { font-family: var(--mono); font-size: 12px; }
  `;
}

export function card(inner: string, opts: { padding?: number } = {}): string {
  const pad = opts.padding ?? tokens.space.s6;
  return `<section style="
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 2px;
    padding: ${pad}px;
  ">${inner}</section>`;
}

export function metric(label: string, value: string, sub?: string): string {
  return `
    <div style="display:flex; flex-direction:column; gap:${tokens.space.s1}px;">
      <div class="micro muted" style="text-transform:uppercase; letter-spacing:0.08em;">${escapeHtml(label)}</div>
      <div style="font-family: var(--display); font-size: 28px; line-height:1;">${escapeHtml(value)}</div>
      ${sub !== undefined ? `<div class="micro muted">${escapeHtml(sub)}</div>` : ""}
    </div>
  `;
}

export function tag(text: string, tone: "ok" | "warn" | "alert" | "neutral" = "neutral"): string {
  const color =
    tone === "ok" ? tokens.color.ok :
    tone === "warn" ? tokens.color.warn :
    tone === "alert" ? tokens.color.alert :
    tokens.color.neutral;
  return `<span class="micro" style="
    color: ${color};
    border: 1px solid ${color};
    padding: 1px 6px;
    border-radius: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  ">${escapeHtml(text)}</span>`;
}

export function microLabel(prefix: string, id: string): string {
  return `<span class="micro muted">${escapeHtml(prefix)}-${escapeHtml(id.slice(0, 4).toUpperCase())}</span>`;
}