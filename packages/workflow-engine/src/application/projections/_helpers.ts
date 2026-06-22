// Internal helpers shared by the three projection functions (Spec 011 §4.2 /
// Plan 011 §2.4). NOT re-exported from the package barrel — these stay inside
// the `application/projections/` directory and are imported only by sibling
// projection files. Mirrors the `_helpers.ts` pattern in
// revenue-visibility/src/application/projections/ (post-PR #45).

import type { Instance, InstanceStatus } from "../../domain/instance.ts";
import type { InstanceQueryOptions, InstanceStatusFilter } from "../../domain/instance-query.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/** Filter instances whose `status` is in the given set. Empty set → no filter. */
export function filterByStatus(
  instances: Instance[],
  status: InstanceStatusFilter[] | undefined,
): Instance[] {
  if (status === undefined || status.length === 0) return instances;
  const allowed = new Set<InstanceStatus>(status);
  return instances.filter((i) => allowed.has(i.status));
}

/** Filter instances whose `startedAt >= since`. */
export function filterSince(
  instances: Instance[],
  since: string | undefined,
): Instance[] {
  if (since === undefined) return instances;
  return instances.filter((i) => i.startedAt >= since);
}

/** Sort by `startedAt` descending (most recent first). Stable for equal starts. */
export function sortByStartedAtDesc(instances: Instance[]): Instance[] {
  return [...instances].sort((a, b) =>
    a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0,
  );
}

/** Apply `options.limit` semantics: default 100, clamp to MAX_LIMIT 1000. */
export function clampLimit(options: InstanceQueryOptions | undefined): number {
  if (options?.limit === undefined) return DEFAULT_LIMIT;
  if (options.limit < 1) return DEFAULT_LIMIT;
  if (options.limit > MAX_LIMIT) return MAX_LIMIT;
  return options.limit;
}

/** Filter by exact-match `workflowName` + optional `workflowVersion`. */
export function filterByWorkflow(
  instances: Instance[],
  options: InstanceQueryOptions | undefined,
): Instance[] {
  if (options?.workflowName === undefined) return instances;
  const wantedName = options.workflowName;
  const wantedVersion = options.workflowVersion;
  return instances.filter((i) => {
    if (i.workflowName !== wantedName) return false;
    if (wantedVersion !== undefined && i.workflowVersion !== wantedVersion) return false;
    return true;
  });
}
