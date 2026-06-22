// `projectQueueStatus` — Spec 011 §4.2 / AC-6.
// Pure function: same `instances` + same `now` → same `QueueStatus`.
//
// Groups by `workflowName`, counts by status, computes 24h totals over the
// `now` anchor (instances whose `updatedAt` is within the last 24h and that
// reached a terminal state). Orders `byWorkflow` by `waitingHumanCount` desc
// then `activeCount` desc so the panel surfaces bottlenecks first.

import type { Instance } from "../../domain/instance.ts";
import type {
  QueueStatus,
  QueueStatusByWorkflow,
} from "../../domain/projection-types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function projectQueueStatus(
  instances: Instance[],
  now: string,
): QueueStatus {
  const nowMs = Date.parse(now);
  const cutoff24h = Number.isFinite(nowMs) ? new Date(nowMs - DAY_MS).toISOString() : null;

  const byName = new Map<string, QueueStatusByWorkflow>();
  let totalActive = 0;
  let totalWaitingHuman = 0;
  let totalCompleted24h = 0;
  let totalCompensated24h = 0;

  for (const inst of instances) {
    if (inst.status === "active") {
      ensureRow(byName, inst.workflowName).activeCount += 1;
      totalActive += 1;
    } else if (inst.status === "waiting_human") {
      ensureRow(byName, inst.workflowName).waitingHumanCount += 1;
      totalWaitingHuman += 1;
    } else if (cutoff24h !== null && inst.updatedAt >= cutoff24h) {
      // Terminal instances contribute to totals only — byWorkflow lists
      // workflows with live activity (AC-6), not completed/compensated-only ones.
      if (inst.status === "completed") totalCompleted24h += 1;
      else if (inst.status === "compensated") totalCompensated24h += 1;
    }
  }

  const byWorkflow = Array.from(byName.values()).sort((a, b) => {
    if (a.waitingHumanCount !== b.waitingHumanCount) {
      return b.waitingHumanCount - a.waitingHumanCount;
    }
    return b.activeCount - a.activeCount;
  });

  return {
    byWorkflow,
    totals: {
      active: totalActive,
      waitingHuman: totalWaitingHuman,
      completed24h: totalCompleted24h,
      compensated24h: totalCompensated24h,
    },
  };
}

function ensureRow(
  byName: Map<string, QueueStatusByWorkflow>,
  workflowName: string,
): QueueStatusByWorkflow {
  let row = byName.get(workflowName);
  if (row === undefined) {
    row = { workflowName, activeCount: 0, waitingHumanCount: 0 };
    byName.set(workflowName, row);
  }
  return row;
}
