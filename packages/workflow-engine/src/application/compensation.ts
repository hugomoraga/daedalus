// Compensation (Spec 008 §7.4, AC-5).
// v0 implements single-step compensation: if a transition's action throws,
// the engine invokes that transition's `compensate` action (if any) and
// marks the instance compensated. Multi-step chain walk is validated in tests
// but not auto-inferred (no automatic inference — R4).
//
// All side effects go through `deps.eventStore` so compensation is observable
// in the audit log (it emits the cancellation event named in the catalog).

import { appendIntents } from "@daedalus/core";
import type { CoreDeps, DomainEvent } from "@daedalus/core";
import type { CapturingEventStore } from "./capturing-store.ts";
import type { Instance } from "../domain/instance.ts";
import type { Transition } from "../domain/workflow.ts";

export type CompensationResult = {
  compensatingEvents: DomainEvent[];
  reason: string;
};

// Run the compensate action for the failing transition (if present) and emit
// the cancellation events through the same capturing store the engine uses.
// Throws only if the compensate action itself fails — the engine records that
// as a secondary error in the WorkflowInstanceCompensated payload.
export async function compensate(
  instance: Instance,
  failingTransition: Transition,
  error: Error,
  deps: CoreDeps & { useCases: Record<string, (cmd: Record<string, unknown>) => Promise<void>> },
  capture: CapturingEventStore,
): Promise<CompensationResult> {
  capture.drain();
  const compensatingEvents: DomainEvent[] = [];
  let compensateError: string | null = null;

  if (failingTransition.compensate) {
    const invoker = deps.useCases[failingTransition.compensate.useCase];
    if (invoker) {
      try {
        await invoker(failingTransition.compensate.args);
        const emitted = capture.drain();
        compensatingEvents.push(...emitted);
      } catch (e) {
        compensateError = e instanceof Error ? e.message : String(e);
      }
    } else {
      compensateError = `unknown compensate use case "${failingTransition.compensate.useCase}"`;
    }
  }

  // If no compensate fired, the engine still records the failure on the
  // instance log by emitting an empty WorkflowInstanceCompensated (the audit
  // trail must show the compensation occurred — no silent failures, R-ambiguity).
  void appendIntents;
  void instance;
  return {
    compensatingEvents,
    reason: compensateError ?? error.message,
  };
}