// Instance query options — input shape for `InstanceStorePort.list` (Spec 011 §3.1).
// Filters compose with AND semantics. Defaults match the panel-friendly case:
// live instances only, no historical completed/compensated unless asked.

import type { InstanceStatus } from "./instance.ts";

export type InstanceStatusFilter = InstanceStatus;

export type InstanceQueryOptions = {
  /** Default: `["active", "waiting_human"]` — the panel-friendly live slice. */
  status?: InstanceStatusFilter[];
  /** Exact match on `workflowName`. */
  workflowName?: string;
  /** Exact match on `workflowVersion`. Usually paired with `workflowName`. */
  workflowVersion?: string;
  /** Default: `100`. Values above `1000` are clamped to `1000` by the adapter. */
  limit?: number;
  /** ISO date — only instances with `startedAt >= since` are returned. */
  since?: string;
};
