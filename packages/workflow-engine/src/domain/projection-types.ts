// Projection result types — what consumers (ATLAS first) get back from the
// three pure projection functions. Spec 011 §3.2 / §3.3 / §3.4.
//
// These shapes are display-oriented. They are not aggregates, not events, not
// stored state — they are derived on demand from `Instance[]` (Spec 011 §6:
// projections emit no events, mutate nothing, change no engine semantics).

export type ActiveProcessView = {
  /** == `Instance.id`. Surfaced so the panel can deep-link by correlation. */
  correlationId: string;
  workflowName: string;
  workflowVersion: string;
  /** Human-readable state name (e.g. "qualified", "approved", "waiting_payment"). */
  currentState: string;
  status: "active" | "waiting_human";
  /** `now - startedAt` in ms. Computed by the projection; `now` is passed in. */
  ageMs: number;
  /** Non-null when `status === "waiting_human"`. */
  pendingTransitionId: string | null;
  /** ISO; from `history[-1]?.firedAt`. `null` if the instance has not fired yet. */
  lastFiredAt: string | null;
};

export type QueueStatusByWorkflow = {
  workflowName: string;
  activeCount: number;
  waitingHumanCount: number;
};

export type QueueStatusTotals = {
  active: number;
  waitingHuman: number;
  /** Completed instances whose `updatedAt` is within the last 24h of `now`. */
  completed24h: number;
  /** Compensated instances whose `updatedAt` is within the last 24h of `now`. */
  compensated24h: number;
};

export type QueueStatus = {
  byWorkflow: QueueStatusByWorkflow[];
  totals: QueueStatusTotals;
};

export type WorkflowMetricsByWorkflow = {
  workflowName: string;
  completedInWindow: number;
  compensatedInWindow: number;
  /** `null` when `completedInWindow === 0` (avoid 0-ambiguity). */
  avgCompletionMs: number | null;
};

export type WorkflowMetricsTotals = {
  completedInWindow: number;
  compensatedInWindow: number;
  /** `null` when `completedInWindow === 0`. */
  avgCompletionMs: number | null;
};

export type WorkflowMetrics = {
  /** Informational: `now - since` in ms. */
  windowMs: number;
  byWorkflow: WorkflowMetricsByWorkflow[];
  totals: WorkflowMetricsTotals;
};
