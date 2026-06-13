// Enrich a domain EventIntent with lineage into a persistable DomainEvent.
// Lineage = tenant + actor + cause + id + timestamp (Auditability by Default).

import type { DomainEvent, EventIntent } from "../domain/event.ts";
import type { CoreDeps } from "./deps.ts";

export function enrich(
  intent: EventIntent,
  ctx: { tenantId: string; actor: string; cause: string | null; newId: () => string; now: () => string },
): DomainEvent {
  return {
    id: ctx.newId(),
    type: intent.type,
    tenantId: ctx.tenantId,
    occurredAt: ctx.now(),
    actor: ctx.actor,
    cause: ctx.cause,
    payload: intent.payload,
  };
}

// Append a batch of intents for one tenant. cause is null in v0 (cause threading is future).
export async function appendIntents(deps: CoreDeps, tenantId: string, intents: EventIntent[]): Promise<void> {
  for (const intent of intents) {
    await deps.eventStore.append(
      enrich(intent, {
        tenantId,
        actor: deps.actor,
        cause: null,
        newId: deps.newId,
        now: deps.now,
      }),
    );
  }
}
