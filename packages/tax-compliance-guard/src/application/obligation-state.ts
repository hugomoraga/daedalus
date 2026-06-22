// Tax & Compliance Guard (Spec 004 Plan §4) — pure obligation state derivation.
// Given a tenant's event stream, returns the current state of every obligation
// (pending / met / missed). Used by sweepDeadlinesUseCase and listObligationsUseCase.
// Pure: same input → same output. No I/O, no clock.
//
// State machine per obligation id:
//   - No ObligationDue seen → not tracked.
//   - ObligationDue seen, no later ObligationMet → "pending" if dueAt >= now, "missed" otherwise.
//   - ObligationDue seen, later ObligationMet seen → "met".
//   - ObligationMissed is terminal; later ObligationMet supersedes "missed" → "met".

import {
  ObligationDue,
  ObligationEvaluationRecorded,
  ObligationMet,
  ObligationMissed,
  type ObligationDuePayload,
  type ObligationMetPayload,
  type ObligationMissedPayload,
  type ObligationEvaluationRecordedPayload,
} from "../domain/obligation.ts";
import type { DomainEvent } from "@daedalus/core";

export type ObligationState = "pending" | "met" | "missed";

export type ObligorState = {
  obligationId: string;
  obligationHumanName: string;
  triggerEventId: string;
  triggerEventType: string;
  dueAt: string;
  ruleSetId: string;
  ruleSetVersion: string;
  requiredHumanAction: string;
  status: ObligationState;
  // Last evaluation (if any). Helps the CLI render the operator surface.
  lastEvaluation?: {
    outcome: "allow" | "deny" | "escalate";
    reason: string;
    policyRef: { policyId: string; version: string } | null;
    ruleId: string | null;
    gateRef?: string;
    eventId: string;
  };
  // Last met / missed event id (for ack / sweep idempotency).
  lastMetEventId?: string;
  lastMissedEventId?: string;
};

export function deriveObligationStates(
  events: readonly DomainEvent[],
  asOf: string,
): ObligorState[] {
  type Draft = {
    obligationId: string;
    obligationHumanName: string;
    triggerEventId: string;
    triggerEventType: string;
    dueAt: string;
    ruleSetId: string;
    ruleSetVersion: string;
    requiredHumanAction: string;
    met: boolean;
    missed: boolean;
    lastMetEventId?: string;
    lastMissedEventId?: string;
    lastEvaluation?: ObligorState["lastEvaluation"];
  };

  const byObligation = new Map<string, Draft>();

  for (const event of events) {
    if (event.type === ObligationDue) {
      const p = event.payload as unknown as ObligationDuePayload;
      // First ObligationDue wins; a duplicate (same obligationId) is a
      // re-trigger (e.g. another PaymentReceived). Preserve the earliest.
      if (!byObligation.has(p.obligationId)) {
        byObligation.set(p.obligationId, {
          obligationId: p.obligationId,
          obligationHumanName: p.obligationHumanName,
          triggerEventId: p.triggerEventId,
          triggerEventType: p.triggerEventType,
          dueAt: p.dueAt,
          ruleSetId: p.ruleSetId,
          ruleSetVersion: p.ruleSetVersion,
          requiredHumanAction: p.requiredHumanAction,
          met: false,
          missed: false,
        });
      }
      continue;
    }
    if (event.type === ObligationMet) {
      const p = event.payload as unknown as ObligationMetPayload;
      const draft = byObligation.get(p.obligationId);
      if (draft !== undefined) {
        draft.met = true;
        draft.lastMetEventId = event.eventId;
      }
      continue;
    }
    if (event.type === ObligationMissed) {
      const p = event.payload as unknown as ObligationMissedPayload;
      const draft = byObligation.get(p.obligationId);
      if (draft !== undefined) {
        draft.missed = true;
        draft.lastMissedEventId = event.eventId;
      }
      continue;
    }
    if (event.type === ObligationEvaluationRecorded) {
      const p = event.payload as unknown as ObligationEvaluationRecordedPayload;
      const draft = byObligation.get(p.obligationId);
      if (draft !== undefined) {
        const lastEval: NonNullable<ObligorState["lastEvaluation"]> = {
          outcome: p.outcome,
          reason: p.reason,
          policyRef: p.policyRef,
          ruleId: p.ruleId,
          eventId: event.eventId,
        };
        if (p.gateRef !== undefined) lastEval.gateRef = p.gateRef;
        draft.lastEvaluation = lastEval;
      }
      continue;
    }
  }

  const asOfMs = new Date(asOf).getTime();
  const out: ObligorState[] = [];
  for (const draft of byObligation.values()) {
    let status: ObligationState;
    if (draft.met) {
      status = "met";
    } else if (draft.missed) {
      status = "missed";
    } else {
      const dueMs = new Date(draft.dueAt).getTime();
      status = dueMs <= asOfMs ? "missed" : "pending";
    }
    const row: ObligorState = {
      obligationId: draft.obligationId,
      obligationHumanName: draft.obligationHumanName,
      triggerEventId: draft.triggerEventId,
      triggerEventType: draft.triggerEventType,
      dueAt: draft.dueAt,
      ruleSetId: draft.ruleSetId,
      ruleSetVersion: draft.ruleSetVersion,
      requiredHumanAction: draft.requiredHumanAction,
      status,
    };
    if (draft.lastEvaluation !== undefined) row.lastEvaluation = draft.lastEvaluation;
    if (draft.lastMetEventId !== undefined) row.lastMetEventId = draft.lastMetEventId;
    if (draft.lastMissedEventId !== undefined) row.lastMissedEventId = draft.lastMissedEventId;
    out.push(row);
  }
  // Stable order: by dueAt ascending, then obligationId.
  out.sort((a, b) => {
    const cmp = a.dueAt.localeCompare(b.dueAt);
    if (cmp !== 0) return cmp;
    return a.obligationId.localeCompare(b.obligationId);
  });
  return out;
}
