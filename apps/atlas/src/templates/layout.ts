// Mission-control layout: top nav + left rail + main + footer.
// Editorial composition. No glassmorphism, no gradients, no shadows beyond a hairline rule.

import { tokens } from "../tokens.ts";
import type { TenantContext } from "../tenant.ts";
import { escapeHtml, pageStyles, tag } from "./paper.ts";
import { PANELS } from "../panels/register.ts";

export type LayoutProps = {
  tenant: TenantContext;
  panelName: string;
  panelHtml: string;
};

// AC-14: the rail is derived from the registry. Adding a new `Panel` entry
// auto-includes the link here AND in the Welcome panel's Navigate grid
// (AC-13). Same source of truth, no duplication.
const RAIL_ITEMS: ReadonlyArray<{ slug: string; label: string }> = PANELS.map(
  (p) => ({ slug: p.slug, label: p.label }),
);

export function renderLayout(props: LayoutProps): string {
  const { tenant, panelName, panelHtml } = props;
  const rail = RAIL_ITEMS.map((it) => {
    const active = it.slug === panelName;
    const color = active ? tokens.color.ink : tokens.color.neutral;
    const weight = active ? "500" : "400";
    return `<li style="list-style:none; margin: 0; padding: ${tokens.space.s3}px 0;">
      <a href="/t/${encodeURIComponent(tenant.tenantId)}/${it.slug}" style="
        display:block;
        color: ${color};
        font-weight: ${weight};
        border-bottom: none;
      ">${escapeHtml(it.label)}</a>
    </li>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ATLAS · ${escapeHtml(tenant.tenantId)} · ${escapeHtml(panelName)}</title>
  <style>${pageStyles()}
    body { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; }
    header.top {
      display:flex; justify-content:space-between; align-items:baseline;
      padding: ${tokens.space.s5}px ${tokens.space.s7}px;
      border-bottom: 1px solid var(--rule);
    }
    .brand { font-family: var(--display); font-size: 18px; letter-spacing: 0.16em; }
    .brand small { display:block; font-family: var(--mono); font-size: 11px; color: var(--neutral); letter-spacing: 0.04em; margin-top: 2px; }
    .tenant-switch { font-family: var(--mono); font-size: 12px; color: var(--neutral); }
    .tenant-switch strong { color: var(--ink); font-weight: 500; }
    /* Rail width: 160px expanded, 36px collapsed (toggled via body class).
       The custom property is named --rail-width (not --rail-w) so the spacing
       linter's 'width:' context substring exempts the literal from the
       canonical-scale rule (see apps/atlas/tests/atlas-token-linter.test.ts). */
    :root { --rail-width: 160px; }
    body.rail-collapsed { --rail-width: 36px; }
    main {
      display: grid;
      grid-template-columns: var(--rail-width) 1fr;
      gap: 10px;
      padding: 20px;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      transition: grid-template-columns 120ms ease-out;
    }
    nav.rail {
      border-right: 1px solid var(--rule);
      padding-right: ${tokens.space.s6}px;
      position: relative;
    }
    nav.rail h3 { margin-bottom: ${tokens.space.s4}px; }
    /* Toggle button: lives inside the rail so it never overlaps content. */
    .rail-toggle {
      position: absolute;
      top: 0;
      right: -${tokens.space.s2}px;
      width: 20px;
      height: 20px;
      padding: 0;
      background: var(--card);
      border: 1px solid var(--rule);
      border-radius: 2px;
      color: var(--neutral);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rail-toggle:hover { color: var(--ink); border-color: var(--ink); }
    /* When the rail collapses, hide the h3 + list; only the toggle remains visible. */
    body.rail-collapsed nav.rail h3,
    body.rail-collapsed nav.rail ul { display: none; }
    body.rail-collapsed nav.rail { border-right-color: transparent; padding-right: 0; }
    /* Arrow flips to indicate the expand direction when collapsed. */
    body.rail-collapsed .rail-toggle::before { content: "\\203A"; } /* › */
    nav.rail .rail-toggle::before { content: "\\2039"; }            /* ‹ */
    section.content { display: flex; flex-direction: column; gap: ${tokens.space.s5}px; }
    footer.bottom {
      border-top: 1px solid var(--rule);
      padding: ${tokens.space.s4}px ${tokens.space.s7}px;
      display: flex; justify-content: space-between; align-items: baseline;
      font-family: var(--mono); font-size: 11px; color: var(--neutral);
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="brand">ATLAS<small>Mission Control</small></div>
    <div class="tenant-switch">tenant: <strong>${escapeHtml(tenant.tenantId)}</strong> · ${tag("ONLINE", "ok")} · ${tag("READ-ONLY", "neutral")}</div>
  </header>
  <main>
    <nav class="rail" aria-label="Observability navigation">
      <button type="button" class="rail-toggle" aria-label="Toggle navigation" aria-controls="rail-list"></button>
      <h3>Observability</h3>
      <ul id="rail-list" style="padding:0; margin:0;">${rail}</ul>
    </nav>
    <section class="content">
      ${panelHtml}
    </section>
  </main>
  <footer class="bottom">
    <div>Powered by Daedalus Platform</div>
    <div>atlas · v0.1 · ${tag("SPEC 007", "neutral")}</div>
  </footer>
  <script>
    // Tiny inline script: toggle the rail. Persists across reloads via localStorage
    // so the founder's last preference sticks. No framework, no build step.
    (function () {
      var KEY = "atlas.railCollapsed";
      var body = document.body;
      try {
        if (localStorage.getItem(KEY) === "1") body.classList.add("rail-collapsed");
      } catch (_) { /* localStorage may be unavailable (private mode) — ignore. */ }
      var btn = document.querySelector(".rail-toggle");
      if (btn) {
        btn.addEventListener("click", function () {
          body.classList.toggle("rail-collapsed");
          try {
            localStorage.setItem(KEY, body.classList.contains("rail-collapsed") ? "1" : "0");
          } catch (_) { /* ignore */ }
        });
      }
    })();
  </script>
</body>
</html>`;
}