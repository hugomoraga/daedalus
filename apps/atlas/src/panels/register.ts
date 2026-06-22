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
import { renderActiveProcessesPanel } from "./active-processes.ts";
import { renderQueueStatusPanel } from "./queue-status.ts";
import { renderWorkflowMetricsPanel } from "./workflow-metrics.ts";
import { renderCompliancePanel } from "./compliance.ts";

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
    backingModel: "core.events.jsonl + workflow-engine.projectActiveProcesses + tax-compliance-guard.deriveObligationStates + tenant.config",
    render: ({ tenant, events, deps }) => renderWelcomePanel(tenant, events, deps),
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
  {
    slug: "active-processes",
    label: "Active Processes",
    backingModel: "workflow-engine.instanceStore.list + projectActiveProcesses",
    render: async (ctx) => renderActiveProcessesPanel(ctx, ctx.deps),
  },
  {
    slug: "queue-status",
    label: "Queue Status",
    backingModel: "workflow-engine.instanceStore.list + projectQueueStatus",
    render: async (ctx) => renderQueueStatusPanel(ctx, ctx.deps),
  },
  {
    slug: "workflow-metrics",
    label: "Workflow Metrics",
    backingModel: "workflow-engine.instanceStore.list + projectWorkflowMetrics (24h window)",
    render: async (ctx) => renderWorkflowMetricsPanel(ctx, ctx.deps),
  },
  {
    slug: "compliance",
    label: "Compliance",
    backingModel: "tax-compliance-guard.deriveObligationStates (pure over event stream)",
    render: async (ctx) => renderCompliancePanel(ctx),
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