// Welcome panel — first thing the operator sees.
// Renders tenant summary + workflow counts (active / waiting human) +
// compliance counts (pending / missed) + last event timestamp. The
// "what needs attention" tiles use alert/warn tones when > 0 (AC-12).

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

export type WelcomeDeps = Pick<AtlasDeps, "instanceStore">;

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
