// Lineage: enrich domain EventIntents into persistable DomainEvents with traceability.
// Minimal correlation strategy (no event bus, no workflow engine):
//   - every flow gets a correlationId; all events in that flow share it
//   - causationId links an event to the one that caused it (null at a flow's origin)
// This is enough for derived events between modules to be followed later.

import type { DomainEvent, EventIntent } from "../domain/event.ts";
import type { CoreDeps } from "./deps.ts";

export type Lineage = {
  correlationId: string;
  causationId: string | null;
};

export function enrich(
  intent: EventIntent,
  ctx: { tenantId: string; actor: string; newId: () => string; now: () => string; lineage: Lineage },
): DomainEvent {
  return {
    eventId: ctx.newId(),
    type: intent.type,
    tenantId: ctx.tenantId,
    occurredAt: ctx.now(),
    actor: ctx.actor,
    causationId: ctx.lineage.causationId,
    correlationId: ctx.lineage.correlationId,
    payload: intent.payload,
  };
}

// Append a batch of intents for one tenant, all sharing the given lineage.
// When `actorOverride` is provided, every event in this batch carries
// `actor = actorOverride` instead of `deps.actor`. This is the seam the
// Platform API (Spec 016 §8 AC-10) uses to record the API-key principal
// on PolicyDecisionRecorded events; non-overriding callers keep
// `deps.actor` semantics unchanged.
export async function appendIntents(
  deps: CoreDeps,
  tenantId: string,
  intents: EventIntent[],
  lineage: Lineage,
  actorOverride?: string,
): Promise<void> {
  const actor = actorOverride ?? deps.actor;
  for (const intent of intents) {
    await deps.eventStore.append(
      enrich(intent, { tenantId, actor, newId: deps.newId, now: deps.now, lineage }),
    );
  }
}

// Start a fresh correlation for a command-initiated flow (the flow's origin: no cause).
export function startLineage(newId: () => string): Lineage {
  return { correlationId: newId(), causationId: null };
}

// Derive lineage for an event reacting to a prior event — the seam for cross-module
// derived events (e.g. Revenue Visibility reacting to ProposalGenerated). No bus needed.
export function followFrom(event: DomainEvent): Lineage {
  return { correlationId: event.correlationId, causationId: event.eventId };
}
