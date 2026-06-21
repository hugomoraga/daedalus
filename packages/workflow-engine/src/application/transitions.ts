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

// Build a use-case command from the action's args map. Supports three shapes:
//   - { "_event": true }              → the triggering event's payload + tenantId
//   - { "field": <literal-value> }    → literal field-by-field command
//   - { "field": "$.path.expression" } → dotted path read from the event
//     ("$.tenantId", "$.payload.leadId", etc.). Read errors → undefined.
//   - mixed: any combination of the above per field.
//
// This is intentionally small and string-based (no DSL). Workflow authors
// stay close to JSON; richer mapping rules are an explicit future spec.
function buildCommand(
  args: Record<string, unknown>,
  event: DomainEvent,
  _instance: Instance,
): Record<string, unknown> {
  if (args["_event"] === true) {
    return { ...event.payload, tenantId: event.tenantId };
  }
  const cmd: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.startsWith("$.")) {
      cmd[key] = readEventPath(event, value.slice(2));
    } else {
      cmd[key] = value;
    }
  }
  return cmd;
}

function readEventPath(event: DomainEvent, path: string): unknown {
  if (path === "tenantId") return event.tenantId;
  if (path === "type") return event.type;
  if (path === "eventId") return event.eventId;
  if (path === "actor") return event.actor;
  if (path === "occurredAt") return event.occurredAt;
  if (path === "correlationId") return event.correlationId;
  if (path === "causationId") return event.causationId;
  if (path === "payload") return event.payload;
  if (path.startsWith("payload.")) {
    const segment = path.slice("payload.".length);
    let cur: unknown = event.payload;
    for (const part of segment.split(".")) {
      if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  }
  return undefined;
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