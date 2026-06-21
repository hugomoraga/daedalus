// Welcome panel — first thing the operator sees.
// Renders tenant summary + counts + last event timestamp.

import type { DomainEvent } from "@daedalus/core";
import type { TenantContext } from "../tenant.ts";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric, microLabel, tag } from "../templates/paper.ts";
import { computeWelcome } from "../projections.ts";

export function renderWelcomePanel(tenant: TenantContext, events: readonly DomainEvent[]): string {
  const snap = computeWelcome(events);
  const last = snap.lastEventAt ?? "—";
  const lastType = snap.lastEventType ?? "—";
  const status = snap.eventCount === 0 ? tag("EMPTY", "warn") : tag("ACTIVE", "ok");

  return `
    ${card(`
      <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s5}px;">
        <div>
          <h1>Welcome</h1>
          <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">${microLabel("TENANT", tenant.tenantId)} · ${microLabel("NODE", "ATLAS")}</div>
        </div>
        <div>${status}</div>
      </header>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s5}px;">
        ${metric("Total events", String(snap.eventCount), "across the entire stream")}
        ${metric("Last event at", last, lastType)}
        ${metric("Currency", tenant.currency, "from tenant config")}
      </div>
    `)}
    ${card(`
      <h2>Operator notes</h2>
      <p class="muted" style="margin-top: ${tokens.space.s3}px; max-width: 60ch;">
        ATLAS is read-only. Every panel here is a view over projections already
        computed by the Daedalus Core and modules. State-changing actions are
        not available through this surface — they remain in the CLI.
      </p>
    `, { padding: tokens.space.s5 })}
  `;
}