// Panel registry — every panel declares its backing model.
// AC-6: a panel whose backing model is not registered is absent, not empty.

import type { DomainEvent } from "@daedalus/core";
import type { TenantContext } from "../tenant.ts";
import type { AtlasDeps } from "../deps.ts";
import { renderWelcomePanel } from "./welcome.ts";
import { renderEventsPanel } from "./events.ts";
import { renderActivityPanel } from "./activity.ts";
import { renderLogsPanel } from "./logs.ts";
import { renderHealthPanel } from "./health.ts";
import { renderThroughputPanel } from "./throughput.ts";
import { renderMonitoringPanel } from "./monitoring.ts";

export type PanelContext = {
  tenant: TenantContext;
  events: readonly DomainEvent[];
  deps: AtlasDeps;
};

export type Panel = {
  readonly slug: string;
  readonly label: string;
  readonly backingModel: string;
  render: (ctx: PanelContext) => string | Promise<string>;
};

export const PANELS: ReadonlyArray<Panel> = [
  {
    slug: "welcome",
    label: "Welcome",
    backingModel: "core.events.jsonl + tenant.config",
    render: ({ tenant, events }) => renderWelcomePanel(tenant, events),
  },
  {
    slug: "events",
    label: "Events",
    backingModel: "core.events.jsonl",
    render: (ctx) => renderEventsPanel(ctx),
  },
  {
    slug: "activity",
    label: "Activity",
    backingModel: "core.events.jsonl (grouped by day)",
    render: (ctx) => renderActivityPanel(ctx),
  },
  {
    slug: "logs",
    label: "Recent Logs",
    backingModel: "core.events.jsonl (last 50)",
    render: (ctx) => renderLogsPanel(ctx),
  },
  {
    slug: "health",
    label: "System Health",
    backingModel: "core.events.jsonl + sha256 replay",
    render: (ctx) => renderHealthPanel(ctx),
  },
  {
    slug: "throughput",
    label: "Throughput",
    backingModel: "core.events.jsonl (windowed per day, hand-drawn SVG)",
    render: (ctx) => renderThroughputPanel(ctx),
  },
  {
    slug: "monitoring",
    label: "Monitoring",
    backingModel: "revenue-visibility.projectFinancialSummary + alerts",
    render: async (ctx) => renderMonitoringPanel(ctx, ctx.deps),
  },
];

export function findPanel(slug: string): Panel | null {
  return PANELS.find((p) => p.slug === slug) ?? null;
}

export async function renderPanel(slug: string, ctx: PanelContext): Promise<string | null> {
  const panel = findPanel(slug);
  if (panel === null) return null;
  return panel.render(ctx);
}