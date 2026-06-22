// Welcome panel — first thing the operator sees.
// Renders tenant summary + workflow counts (active / waiting human) +
// compliance counts (pending / missed) + last event timestamp + a
// Navigate grid linking to the other 10 panels.
// AC-12 (workflow + compliance counts) + AC-13 (Navigate grid).

import type { DomainEvent } from "@daedalus/core";
import type { TenantContext } from "../tenant.ts";
import {
  projectActiveProcesses,
  type ActiveProcessView,
} from "@daedalus/workflow-engine";
import {
  deriveObligationStates,
  type ObligorState,
  type ObligationState,
} from "@daedalus/tax-compliance-guard";
import { tokens } from "../tokens.ts";
import { card, escapeHtml, metric, microLabel, tag } from "../templates/paper.ts";
import { computeWelcome } from "../projections.ts";
import type { AtlasDeps } from "../deps.ts";
import { PANELS, type Panel } from "./register.ts";

export type WelcomeDeps = Pick<AtlasDeps, "instanceStore">;

const WELCOME_SLUG = "welcome";

// AC-13: build the navigation list at render time (not module top
// level) to avoid a circular import — register.ts imports
// renderWelcomePanel, and reading PANELS at top level triggers
// `Cannot access 'PANELS' before initialization` under ESM TDZ.
function navigateTargets(): ReadonlyArray<Panel> {
  return PANELS.filter((p) => p.slug !== WELCOME_SLUG);
}

export async function renderWelcomePanel(
  tenant: TenantContext,
  events: readonly DomainEvent[],
  deps: WelcomeDeps,
): Promise<string> {
  const snap = computeWelcome(events);
  const last = snap.lastEventAt ?? "—";
  const lastType = snap.lastEventType ?? "—";
  const status = snap.eventCount === 0 ? tag("EMPTY", "warn") : tag("ACTIVE", "ok");

  const now = new Date().toISOString();
  const instances = await deps.instanceStore.list(tenant.tenantId);
  const activeView = projectActiveProcesses(instances, now);
  const activeCount = activeView.length;
  const waitingCount = activeView.filter((r: ActiveProcessView) => r.status === "waiting_human").length;

  const obligations = deriveObligationStates(events, now);
  const pendingCount = obligations.filter((o: ObligorState) => o.status === "pending").length;
  const missedCount = obligations.filter((o: ObligorState) => o.status === "missed").length;

  return `
    ${card(`
      <header style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: ${tokens.space.s5}px;">
        <div>
          <h1>Welcome</h1>
          <div class="micro muted" style="margin-top: ${tokens.space.s1}px;">${microLabel("TENANT", tenant.tenantId)} · ${microLabel("NODE", "ATLAS")} · ${microLabel("CCY", tenant.currency)}</div>
        </div>
        <div>${status}</div>
      </header>
      <div class="muted" style="margin-bottom: ${tokens.space.s3}px; font-size: 12px;">What needs attention</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s5}px; margin-bottom: ${tokens.space.s4}px;">
        ${metric("Active workflows", String(activeCount), "from workflow engine")}
        ${metric(
          "Waiting human",
          String(waitingCount),
          waitingCount > 0 ? "stalled at human gate" : "no humans needed",
          waitingCount > 0 ? "warn" : "neutral",
        )}
        ${metric("Pending obligations", String(pendingCount), "from tax compliance")}
      </div>
      <div class="muted" style="margin-bottom: ${tokens.space.s3}px; font-size: 12px;">General health</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: ${tokens.space.s5}px;">
        ${metric(
          "Missed obligations",
          String(missedCount),
          missedCount > 0 ? "action required" : "all on track",
          missedCount > 0 ? "alert" : "neutral",
        )}
        ${metric("Last event at", last, lastType)}
        ${metric("Total events", String(snap.eventCount), "across the entire stream")}
      </div>
    `)}
    ${card(renderNavigate(tenant.tenantId, navigateTargets()), { padding: tokens.space.s5 })}
  `;
}

// AC-13 — the Navigate grid. Each link is a card with the panel's label +
// its slug + a small "→" affordance. The cards scroll horizontally in a
// CSS-only marquee (the track holds the cards twice, animation translates
// -50% to loop seamlessly, pauses on hover). Replaces the previous dense
// auto-fit grid that crammed long labels like "Active Processes" into
// narrow columns on wide viewports.
function renderNavigate(tenantId: string, targets: ReadonlyArray<Panel>): string {
  const cards = targets.map((panel) => {
    const href = `/t/${tenantId}/${panel.slug}`;
    return `
      <a class="navigate-card" href="${escapeHtml(href)}">
        <span>${escapeHtml(panel.label)}</span>
        <span class="micro muted">${escapeHtml(panel.slug)} &rarr;</span>
      </a>
    `;
  }).join("");
  // Duplicate the cards so the -50% translateX loops seamlessly.
  const track = cards + cards;

  return `
    <h2>Navigate</h2>
    <p class="muted" style="margin-top: ${tokens.space.s2}px; max-width: 60ch;">${targets.length} panels — every other view in ATLAS. Hover to pause.</p>
    <div class="navigate-rail">
      <div class="navigate-track">${track}</div>
    </div>
  `;
}
