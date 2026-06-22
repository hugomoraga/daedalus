// `projectActiveProcesses` — Spec 011 §4.2 / AC-5.
// Pure function: same `instances` + same `now` → same `ActiveProcessView[]`.
//
// Filters to the live slice (`active` + `waiting_human`), maps each instance
// to a display row (8 fields), sorts by `ageMs` descending (oldest first —
// what an operator wants to see at the top of an Active Processes panel).

import type { Instance } from "../../domain/instance.ts";
import type { ActiveProcessView } from "../../domain/projection-types.ts";

const LIVE_STATUSES = new Set(["active", "waiting_human"] as const);

export function projectActiveProcesses(
  instances: Instance[],
  now: string,
): ActiveProcessView[] {
  const nowMs = Date.parse(now);
  const rows: ActiveProcessView[] = [];
  for (const inst of instances) {
    if (!LIVE_STATUSES.has(inst.status as "active" | "waiting_human")) continue;
    const startedAtMs = Date.parse(inst.startedAt);
    const lastFired = inst.history.length > 0 ? inst.history[inst.history.length - 1] : null;
    rows.push({
      correlationId: inst.id,
      workflowName: inst.workflowName,
      workflowVersion: inst.workflowVersion,
      currentState: inst.currentState as string,
      status: inst.status,
      ageMs: Number.isFinite(nowMs) && Number.isFinite(startedAtMs)
        ? Math.max(0, nowMs - startedAtMs)
        : 0,
      pendingTransitionId: inst.pendingTransitionId,
      lastFiredAt: lastFired ? lastFired.firedAt : null,
    });
  }
  // Sort by ageMs desc — oldest at the top.
  rows.sort((a, b) => b.ageMs - a.ageMs);
  return rows;
}
