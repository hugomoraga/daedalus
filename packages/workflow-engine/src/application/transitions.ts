// Transitions: evaluate, invoke actions, advance instance state.
// Pure dispatch logic. Side effects (event emission, instance persistence)
// live in the engine loop (./engine.ts) and the adapters.

import type { CoreDeps, DomainEvent } from "@daedalus/core";
import type { CapturingEventStore } from "./capturing-store.ts";
import type { Instance } from "../domain/instance.ts";
import type { Transition, Workflow } from "../domain/workflow.ts";
import { evaluateGuard } from "../domain/guard.ts";

// Match a workflow's initial state against an incoming event. The workflow's
// initial state has an `on` rule for the event type — if the event is of that
// type, this workflow starts a new instance on this event.
export function matchesInitialTrigger(workflow: Workflow, event: DomainEvent): boolean {
  const initialState = workflow.states[workflow.initial];
  if (!initialState) return false;
  return Object.prototype.hasOwnProperty.call(initialState.on, event.type);
}

// Evaluate transitions: find every transition on the current state whose
// trigger event matches and whose guard passes. Returns the ordered list
// (caller may filter further for requiresHuman / policy).
export function evaluateTransitions(
  workflow: Workflow,
  instance: Instance,
  event: DomainEvent,
): Transition[] {
  const state = workflow.states[instance.currentState];
  if (!state || !state.on) return [];
  const candidates = state.on[event.type] ?? [];
  return candidates.filter((t) => evaluateGuard(t.guard, event, instance));
}

// Invoke a transition's actions in order, capturing every event the actions
// append. Returns the captured events so the engine can attach their ids to
// the WorkflowTransitionFired engine event (Spec 008 AC-3).
export async function invokeActions(
  transition: Transition,
  event: DomainEvent,
  instance: Instance,
  deps: CoreDeps & { useCases: Record<string, (cmd: Record<string, unknown>, runtime: CoreDeps) => Promise<void>> },
  capture: CapturingEventStore,
): Promise<DomainEvent[]> {
  if (!transition.actions || transition.actions.length === 0) return [];
  capture.drain();
  // Hand each invoker the CURRENT deps — the engine wraps `eventStore` in a
  // capturing store per dispatch tick so we can record what the actions emit.
  const runtimeDeps: CoreDeps = { ...deps, eventStore: capture };
  for (const action of transition.actions) {
    const invoker = deps.useCases[action.useCase];
    if (!invoker) {
      throw new Error(
        `unknown use case "${action.useCase}" on transition ${transition.id} of workflow ${instance.workflowName} v${instance.workflowVersion}`,
      );
    }
    const command = buildCommand(action.args, event, instance);
    await invoker(command, runtimeDeps);
  }
  return capture.drain();
}

// Build a use-case command from the action's args map. v0 supports two shapes:
//   - { "_event": true }            → the triggering event's payload (verbatim)
//   - { "field": <literal-value> }  → field-by-field literal command
// Field-by-event is a future enhancement (e.g. dotted-path expressions).
function buildCommand(
  args: Record<string, unknown>,
  event: DomainEvent,
  _instance: Instance,
): Record<string, unknown> {
  if (args["_event"] === true) {
    return { ...event.payload, tenantId: event.tenantId };
  }
  return { ...args };
}

// Advance the instance to the transition's target state. Pure — returns a new
// instance. Records the transition in history and updates lastSeenEventId.
export function advanceInstance(
  instance: Instance,
  transition: Transition,
  firedAt: string,
  triggerEvent: DomainEvent,
): Instance {
  return {
    ...instance,
    currentState: transition.target,
    status: "active",
    pendingTransitionId: null,
    firedTransitionIds: [...instance.firedTransitionIds, transition.id],
    history: [
      ...instance.history,
      {
        transitionId: transition.id,
        fromState: instance.currentState,
        toState: transition.target,
        firedAt,
        triggerEventId: triggerEvent.eventId,
      },
    ],
    updatedAt: firedAt,
    lastSeenEventId: triggerEvent.eventId,
  };
}

// Mark an instance as waiting on a human. Pure — returns a new instance.
export function markWaitingHuman(
  instance: Instance,
  transition: Transition,
  updatedAt: string,
): Instance {
  return {
    ...instance,
    status: "waiting_human",
    pendingTransitionId: transition.id,
    updatedAt,
    lastSeenEventId: instance.lastSeenEventId,
  };
}

// Mark an instance as completed (terminal state reached). Pure — returns new.
export function markCompleted(instance: Instance, updatedAt: string): Instance {
  return {
    ...instance,
    status: "completed",
    pendingTransitionId: null,
    updatedAt,
  };
}

// Mark an instance as compensated (compensation chain finished). Pure.
export function markCompensated(instance: Instance, updatedAt: string): Instance {
  return {
    ...instance,
    status: "compensated",
    pendingTransitionId: null,
    updatedAt,
  };
}