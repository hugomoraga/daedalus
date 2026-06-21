// Capturing event store — wraps a real EventStorePort to record every event
// the engine's actions emit through it. Lets the engine attach the captured
// event ids to its own WorkflowTransitionFired event (Spec 008 AC-3).
// The wrapper forwards to the real store unchanged; behavior is identical
// from the caller's perspective.

import type { DomainEvent, EventStorePort } from "@daedalus/core";

export interface CapturingEventStore extends EventStorePort {
  // Return and clear the captured events since the last drain. Use once per
  // dispatch tick — the engine drains after firing each transition.
  drain(): DomainEvent[];
}

export function capturingEventStore(real: EventStorePort): CapturingEventStore {
  const captured: DomainEvent[] = [];
  return {
    append: async (event: DomainEvent) => {
      captured.push(event);
      await real.append(event);
    },
    readStream: real.readStream.bind(real),
    drain: () => {
      const out = captured.slice();
      captured.length = 0;
      return out;
    },
  };
}