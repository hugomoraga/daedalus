// Tax & Compliance Guard — acknowledgeObligationUseCase (Spec 004 Plan
// §3.3, T-07). Emits ObligationMet for a pending obligation. Validates
// the obligation is actually pending (not met, not missed, not unknown).
// This is the ONLY human path to acknowledge an obligation (per Spec 004
// §3 — the system never auto-acks).

import {
  appendIntents,
  startLineage,
  type DomainEvent,
} from "@daedalus/core";
import { ObligationMet, type ObligationMetPayload } from "../domain/obligation.ts";
import { deriveObligationStates } from "./obligation-state.ts";
import type { TaxComplianceDeps } from "./deps.ts";

export class ObligationNotPending extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObligationNotPending";
  }
}

export class UnknownObligation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownObligation";
  }
}

export type AcknowledgeObligationInput = {
  tenantId: string;
  obligationId: string;
  dueEventId: string; // the ObligationDue event id the ack refers to
  actor: string;
  notes?: string;
};

export type AcknowledgeObligationResult = {
  event: DomainEvent;
};

export async function acknowledgeObligationUseCase(
  deps: TaxComplianceDeps,
  input: AcknowledgeObligationInput,
): Promise<AcknowledgeObligationResult> {
  const events = await deps.eventStore.readStream(input.tenantId);
  const states = deriveObligationStates(events, deps.now());
  const state = states.find((s) => s.obligationId === input.obligationId);
  if (state === undefined) {
    throw new UnknownObligation(`obligation not found: ${input.obligationId}`);
  }
  if (state.status !== "pending") {
    throw new ObligationNotPending(
      `obligation ${input.obligationId} is ${state.status}; cannot ack`,
    );
  }
  if (state.triggerEventId !== input.dueEventId) {
    throw new ObligationNotPending(
      `obligation ${input.obligationId} dueEventId mismatch: expected ${state.triggerEventId}, got ${input.dueEventId}`,
    );
  }
  const payload: ObligationMetPayload = {
    obligationId: input.obligationId,
    dueEventId: input.dueEventId,
    actor: input.actor,
  };
  if (input.notes !== undefined && input.notes.length > 0) {
    payload.notes = input.notes;
  }
  // The ack is a fresh flow — new correlationId, causationId=null.
  await appendIntents(
    deps,
    input.tenantId,
    [{ type: ObligationMet, payload: payload as unknown as Record<string, unknown> }],
    startLineage(deps.newId),
  );
  const after = await deps.eventStore.readStream(input.tenantId);
  const event = after[after.length - 1];
  if (event === undefined || event.type !== ObligationMet) {
    throw new Error("ObligationMet not found after appendIntents");
  }
  return { event };
}
