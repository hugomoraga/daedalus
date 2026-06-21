// Panel registry — every panel declares its backing model.
// AC-6: a panel whose backing model is not registered is absent, not empty.

import type { DomainEvent } from "@daedalus/core";
import type { TenantContext } from "../tenant.ts";
import { renderWelcomePanel } from "./welcome.ts";

export type PanelContext = {
  tenant: TenantContext;
  events: readonly DomainEvent[];
};

export type Panel = {
  readonly slug: string;
  readonly label: string;
  readonly backingModel: string;
  render: (ctx: PanelContext) => string;
};

export const PANELS: ReadonlyArray<Panel> = [
  {
    slug: "welcome",
    label: "Welcome",
    backingModel: "core.events.jsonl + tenant.config",
    render: ({ tenant, events }) => renderWelcomePanel(tenant, events),
  },
  // Events, Activity, Logs, System Health arrive in v0.2 / v0.3 / v0.4.
];

export function findPanel(slug: string): Panel | null {
  return PANELS.find((p) => p.slug === slug) ?? null;
}

export function renderPanel(slug: string, ctx: PanelContext): string | null {
  const panel = findPanel(slug);
  if (panel === null) return null;
  return panel.render(ctx);
}