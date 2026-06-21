// Mission-control layout: top nav + left rail + main + footer.
// Editorial composition. No glassmorphism, no gradients, no shadows beyond a hairline rule.

import { tokens } from "../tokens.ts";
import type { TenantContext } from "../tenant.ts";
import { escapeHtml, pageStyles, tag } from "./paper.ts";

export type LayoutProps = {
  tenant: TenantContext;
  panelName: string;
  panelHtml: string;
};

const RAIL_ITEMS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "welcome", label: "Welcome" },
  { slug: "events", label: "Events" },
  { slug: "activity", label: "Activity" },
  { slug: "logs", label: "Recent Logs" },
  { slug: "health", label: "System Health" },
  { slug: "throughput", label: "Throughput" },
  { slug: "monitoring", label: "Monitoring" },
];

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
    main {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: ${tokens.space.s7}px;
      padding: ${tokens.space.s7}px;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
    }
    nav.rail { border-right: 1px solid var(--rule); padding-right: ${tokens.space.s6}px; }
    nav.rail h3 { margin-bottom: ${tokens.space.s4}px; }
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
    <nav class="rail">
      <h3>Observability</h3>
      <ul style="padding:0; margin:0;">${rail}</ul>
    </nav>
    <section class="content">
      ${panelHtml}
    </section>
  </main>
  <footer class="bottom">
    <div>Powered by Daedalus Platform</div>
    <div>atlas · v0.1 · ${tag("SPEC 007", "neutral")}</div>
  </footer>
</body>
</html>`;
}