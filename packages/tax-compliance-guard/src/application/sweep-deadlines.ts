// Tax & Compliance Guard — sweepDeadlinesUseCase (Spec 004 Plan §3.2,
// T-06). Walks the tenant's event stream, derives the live obligation
// state, and emits ObligationMissed for any `pending` obligation whose
// dueAt is in the past. Idempotent: re-running the sweep does NOT
// re-emit for obligations already met or missed.

import {
  appendIntents,
  followFrom,
  type DomainEvent,
} from "@daedalus/core";
import {
  ObligationDue,
  ObligationMet,
  ObligationMissed,
  type ObligationMissedPayload,
} from "../domain/obligation.ts";
import { deriveObligationStates } from "./obligation-state.ts";
import type { TaxComplianceDeps } from "./deps.ts";

export type SweepDeadlinesInput = {
  tenantId: string;
  asOf?: string;
  actor?: string;
};

export type SweepDeadlinesResult = {
  scanned: number;
  missed: number;
  missedObligationIds: string[];
};

export async function sweepDeadlinesUseCase(
  deps: TaxComplianceDeps,
  input: SweepDeadlinesInput,
): Promise<SweepDeadlinesResult> {
  const asOf = input.asOf ?? (deps.asOf !== undefined ? deps.asOf() : deps.now());
  const events = await deps.eventStore.readStream(input.tenantId);
  const states = deriveObligationStates(events, asOf);
  const missedNow: string[] = [];
  for (const state of states) {
    if (state.status !== "missed") continue;
    // Idempotency: if the stream already has an ObligationMissed event
    // for this obligation, skip. The pure derivation considers both
    // "explicitly missed" AND "due-in-the-past-and-not-met" as missed;
    // we only want to emit NEW misses here.
    if (state.lastMissedEventId !== undefined) continue;
    // Find the corresponding ObligationDue event for causation.
    const dueEvent = findObligationDueEvent(events, state.obligationId);
    if (dueEvent === null) continue;
    const payload: ObligationMissedPayload = {
      obligationId: state.obligationId,
      dueEventId: state.triggerEventId, // = the ObligationDue's trigger event id
      dueAt: state.dueAt,
      detectedAt: asOf,
    };
    // We use followFrom(dueEvent) so the lineage chains through the
    // ObligationDue → ObligationMissed.
    void ObligationMet; // imported for completeness; no logic here.
    await appendIntents(
      deps,
      input.tenantId,
      [{ type: ObligationMissed, payload: payload as unknown as Record<string, unknown> }],
      followFrom(dueEvent),
    );
    void ObligationDue; // used implicitly via findObligationDueEvent.
    missedNow.push(state.obligationId);
  }
  return {
    scanned: states.length,
    missed: missedNow.length,
    missedObligationIds: missedNow,
  };
}

function findObligationDueEvent(
  events: readonly DomainEvent[],
  obligationId: string,
): DomainEvent | null {
  // The ObligationDue's event id is `triggerEventId` in the derived state
  // for fresh dues; for re-triggered dues, we want the most recent
  // ObligationDue whose payload.obligationId === obligationId.
  let latest: DomainEvent | null = null;
  for (const event of events) {
    if (event.type !== ObligationDue) continue;
    const p = event.payload as { obligationId?: string };
    if (p.obligationId !== obligationId) continue;
    latest = event;
  }
  return latest;
}
