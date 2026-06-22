// `projectWorkflowMetrics` — Spec 011 §4.2 / AC-7.
// Pure function: same `instances` + same `since` + same `now` → same
// `WorkflowMetrics`.
//
// Filters to instances that reached a terminal state within `[since, now]`,
// counts per workflow + totals, and computes `avgCompletionMs` as the mean of
// `(history[-1].firedAt - startedAt)` over completed instances in the window.
// `null` when zero completions (avoid 0-ambiguity).

import type { Instance } from "../../domain/instance.ts";
import type {
  WorkflowMetrics,
  WorkflowMetricsByWorkflow,
} from "../../domain/projection-types.ts";

export function projectWorkflowMetrics(
  instances: Instance[],
  since: string,
  now: string,
): WorkflowMetrics {
  const sinceMs = Date.parse(since);
  const nowMs = Date.parse(now);

  const byName = new Map<string, WorkflowMetricsByWorkflow>();
  let totalCompleted = 0;
  let totalCompensated = 0;
  let totalDurationSum = 0;

  for (const inst of instances) {
    const updatedMs = Date.parse(inst.updatedAt);
    if (!Number.isFinite(updatedMs)) continue;
    if (updatedMs < sinceMs || updatedMs > nowMs) continue;
    if (inst.status !== "completed" && inst.status !== "compensated") continue;

    let row = byName.get(inst.workflowName);
    if (row === undefined) {
      row = {
        workflowName: inst.workflowName,
        completedInWindow: 0,
        compensatedInWindow: 0,
        avgCompletionMs: null,
      };
      byName.set(inst.workflowName, row);
    }

    if (inst.status === "completed") {
      row.completedInWindow += 1;
      totalCompleted += 1;
      const lastFired = inst.history.length > 0
        ? inst.history[inst.history.length - 1]
        : null;
      if (lastFired !== null) {
        const dur = Date.parse(lastFired.firedAt) - Date.parse(inst.startedAt);
        if (Number.isFinite(dur) && dur >= 0) {
          // Accumulate per-workflow sum; we'll finalize the mean below.
          // Using a side Map keeps this loop allocation-light.
          perWorkflowDurationSums.set(inst.workflowName,
            (perWorkflowDurationSums.get(inst.workflowName) ?? 0) + dur);
          totalDurationSum += dur;
        }
      }
    } else {
      row.compensatedInWindow += 1;
      totalCompensated += 1;
    }
  }

  // Finalize per-workflow averages.
  for (const [name, row] of byName) {
    if (row.completedInWindow === 0) {
      row.avgCompletionMs = null;
    } else {
      const sum = perWorkflowDurationSums.get(name) ?? 0;
      row.avgCompletionMs = Math.round(sum / row.completedInWindow);
    }
  }
  perWorkflowDurationSums.clear();

  const totalAvg = totalCompleted === 0
    ? null
    : Math.round(totalDurationSum / totalCompleted);

  return {
    windowMs: Number.isFinite(nowMs) && Number.isFinite(sinceMs) ? nowMs - sinceMs : 0,
    byWorkflow: Array.from(byName.values()),
    totals: {
      completedInWindow: totalCompleted,
      compensatedInWindow: totalCompensated,
      avgCompletionMs: totalAvg,
    },
  };
}

// Module-scoped scratch map to avoid allocation in the hot loop. Cleared at
// the end of every call. NOT exported. Single-threaded Node use only.
const perWorkflowDurationSums = new Map<string, number>();
