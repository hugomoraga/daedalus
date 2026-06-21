// The Workflow Engine loop.
// Spec 008 §7 (engine loop binding), Plan 008 §4 (pseudocode).
//
// Reads the tenant's event stream, evaluates each new event against active
// workflow instances, fires transitions (or gates on humans / policy), and
// emits engine events with full lineage. One process, one event store, polling.

import type { CoreDeps, DomainEvent, Lineage } from "@daedalus/core";
import { appendIntents, followFrom, startLineage } from "@daedalus/core";
import { capturingEventStore, type CapturingEventStore } from "./capturing-store.ts";
import {
  HumanApproved,
  HumanRejected,
  WorkflowInstanceCompensated,
  WorkflowInstanceCompleted,
  WorkflowInstanceStarted,
  WorkflowTransitionFired,
  HumanApprovalRequired,
  isEngineEvent,
} from "../domain/engine-events.ts";
import { newInstance, type Instance } from "../domain/instance.ts";
import type { Workflow } from "../domain/workflow.ts";
import type { EngineDeps } from "./deps.ts";
import {
  advanceInstance,
  evaluateTransitions,
  invokeActions,
  markCompleted,
  markCompensated,
  markWaitingHuman,
  matchesInitialTrigger,
} from "./transitions.ts";
import { compensate } from "./compensation.ts";

export type EngineOptions = {
  pollMs?: number; // poll interval; default 200ms
  sleep?: (ms: number) => Promise<void>; // injectable for tests
  signal?: AbortSignal; // optional cancellation
};

export type EngineHandle = {
  stop: () => void;
};

export function runEngine(
  deps: EngineDeps,
  tenantId: string,
  options: EngineOptions = {},
): EngineHandle {
  const pollMs = options.pollMs ?? 200;
  const sleep = options.sleep ?? defaultSleep;
  let stopped = false;
  const capture = capturingEventStore(deps.eventStore);
  const dispatchDeps: EngineDeps = { ...deps, eventStore: capture };

  void run();

  async function run(): Promise<void> {
    const workflows = await deps.workflowStore.loadFor(tenantId);
    let cursor = await deps.instanceStore.getCursor(tenantId);
    while (!stopped) {
      options.signal?.throwIfAborted();
      const events = await deps.eventStore.readStream(tenantId);
      const fresh = filterAfterCursor(events, cursor);
      for (const event of fresh) {
        if (stopped) break;
        cursor = event.occurredAt;
        await deps.instanceStore.setCursor(tenantId, cursor);
        await dispatch(event, workflows, dispatchDeps, tenantId);
      }
      await sleep(pollMs);
    }
  }

  return {
    stop: () => {
      stopped = true;
    },
  };
}

// One pass for one event: start instances for any matching initial trigger,
// then evaluate every active instance against its transitions. Per the spec,
// engine-originated events fall through naturally (no workflow matches them)
// except HumanApproved / HumanRejected which clear pending gates.
async function dispatch(
  event: DomainEvent,
  workflows: Workflow[],
  deps: EngineDeps,
  tenantId: string,
): Promise<void> {
  if (isEngineEvent(event.type)) {
    if (event.type === HumanApproved || event.type === HumanRejected) {
      await resolveHumanGate(event, workflows, deps, tenantId);
    }
    return;
  }

  for (const workflow of workflows) {
    const existing = await deps.instanceStore.findByCorrelationId(tenantId, event.correlationId);
    let instance = existing.find(
      (i) => i.workflowName === workflow.name && i.workflowVersion === workflow.version,
    );

    if (!instance && matchesInitialTrigger(workflow, event)) {
      instance = await startInstance(workflow, event, deps, tenantId);
    }
    if (!instance) continue;

    const matched = evaluateTransitions(workflow, instance, event);
    for (const transition of matched) {
      if (instance.firedTransitionIds.includes(transition.id)) continue; // AC-2 idempotency
      await fireTransition(workflow, transition, event, instance, deps, tenantId);
    }
  }
}

async function startInstance(
  workflow: Workflow,
  triggerEvent: DomainEvent,
  deps: EngineDeps,
  tenantId: string,
): Promise<Instance> {
  const instance = newInstance({
    id: triggerEvent.correlationId,
    workflowName: workflow.name,
    workflowVersion: workflow.version,
    tenantId,
    initialState: workflow.initial,
    startedAt: triggerEvent.occurredAt,
    triggerEvent,
  });
  const lineage: Lineage = {
    correlationId: instance.id,
    causationId: triggerEvent.eventId,
  };
  await appendIntents(
    deps,
    tenantId,
    [
      {
        type: WorkflowInstanceStarted,
        payload: {
          workflowName: workflow.name,
          workflowVersion: workflow.version,
          initialState: workflow.initial,
          triggerEventType: triggerEvent.type,
        },
      },
    ],
    lineage,
  );
  await deps.instanceStore.save(tenantId, instance);
  return instance;
}

async function fireTransition(
  workflow: Workflow,
  transition: Workflow["states"][string]["on"][string][number],
  event: DomainEvent,
  instance: Instance,
  deps: EngineDeps,
  tenantId: string,
): Promise<void> {
  const lineage: Lineage = { correlationId: instance.id, causationId: event.eventId };

  // Human gate (Spec 008 §5, AC-4). Mark waiting and emit the request; do not invoke actions.
  if (transition.requiresHuman) {
    const waiting = markWaitingHuman(instance, transition, deps.now());
    await deps.instanceStore.save(tenantId, waiting);
    await appendIntents(
      deps,
      tenantId,
      [
        {
          type: HumanApprovalRequired,
          payload: {
            workflowName: workflow.name,
            workflowVersion: workflow.version,
            transitionId: transition.id,
            target: transition.target,
            triggerEventType: event.type,
          },
        },
      ],
      lineage,
    );
    return;
  }

  // Policy seam (AC-9). A denial routes to a human gate, not a silent skip.
  const decision = await deps.policy.decide(transition, event, instance);
  if (!decision.allow) {
    const waiting = markWaitingHuman(instance, transition, deps.now());
    await deps.instanceStore.save(tenantId, waiting);
    await appendIntents(
      deps,
      tenantId,
      [
        {
          type: HumanApprovalRequired,
          payload: {
            workflowName: workflow.name,
            workflowVersion: workflow.version,
            transitionId: transition.id,
            target: transition.target,
            triggerEventType: event.type,
            deniedByPolicy: true,
            denialReason: decision.reason,
          },
        },
      ],
      lineage,
    );
    return;
  }

  // Fire actions (or skip if the transition has none — observational v0 workflows).
  const capture = deps.eventStore as CapturingEventStore;
  try {
    const captured = await invokeActions(transition, event, instance, deps, capture);
    const advanced = advanceInstance(instance, transition, deps.now(), event);
    await deps.instanceStore.save(tenantId, advanced);
    await appendIntents(
      deps,
      tenantId,
      [
        {
          type: WorkflowTransitionFired,
          payload: {
            workflowName: workflow.name,
            workflowVersion: workflow.version,
            transitionId: transition.id,
            fromState: instance.currentState,
            toState: transition.target,
            triggerEventType: event.type,
            actionEventIds: captured.map((e) => e.eventId),
            actionEventTypes: captured.map((e) => e.type),
          },
        },
      ],
      lineage,
    );
    if (workflow.terminal.includes(transition.target)) {
      const completed = markCompleted(advanced, deps.now());
      await deps.instanceStore.save(tenantId, completed);
      await appendIntents(
        deps,
        tenantId,
        [
          {
            type: WorkflowInstanceCompleted,
            payload: {
              workflowName: workflow.name,
              workflowVersion: workflow.version,
              finalState: transition.target,
            },
          },
        ],
        lineage,
      );
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const result = await compensate(instance, transition, error, deps, capture);
    const compensated = markCompensated(instance, deps.now());
    await deps.instanceStore.save(tenantId, compensated);
    await appendIntents(
      deps,
      tenantId,
      [
        {
          type: WorkflowInstanceCompensated,
          payload: {
            workflowName: workflow.name,
            workflowVersion: workflow.version,
            failingTransitionId: transition.id,
            failureReason: error.message,
            compensateError: result.reason,
            compensatingEventIds: result.compensatingEvents.map((ev) => ev.eventId),
          },
        },
      ],
      lineage,
    );
  }
}

// When a HumanApproved event arrives, find the waiting instance by correlationId
// and fire its pending transition. A HumanRejected event triggers compensation
// for the pending transition (single-step: invoke its compensate if any, then
// mark the instance compensated).
async function resolveHumanGate(
  event: DomainEvent,
  workflows: Workflow[],
  deps: EngineDeps,
  tenantId: string,
): Promise<void> {
  const instances = await deps.instanceStore.findByCorrelationId(tenantId, event.correlationId);
  for (const instance of instances) {
    if (instance.pendingTransitionId === null) continue;
    const workflow = workflows.find(
      (w) => w.name === instance.workflowName && w.version === instance.workflowVersion,
    );
    if (!workflow) continue;
    const state = workflow.states[instance.currentState];
    if (!state) continue;
    // Find the pending transition by id across the state's on-triggers.
    let pending: Workflow["states"][string]["on"][string][number] | null = null;
    for (const transitions of Object.values(state.on)) {
      const found = transitions.find((t) => t.id === instance.pendingTransitionId);
      if (found) {
        pending = found;
        break;
      }
    }
    if (!pending) continue;

    if (event.type === HumanRejected) {
      const capture = deps.eventStore as CapturingEventStore;
      const result = await compensate(
        instance,
        pending,
        new Error("rejected by human"),
        deps,
        capture,
      );
      const compensated = markCompensated(instance, deps.now());
      await deps.instanceStore.save(tenantId, compensated);
      await appendIntents(
        deps,
        tenantId,
        [
          {
            type: WorkflowInstanceCompensated,
            payload: {
              workflowName: instance.workflowName,
              workflowVersion: instance.workflowVersion,
              failingTransitionId: pending.id,
              failureReason: "rejected by human",
              compensateError: result.reason,
              compensatingEventIds: result.compensatingEvents.map((e) => e.eventId),
            },
          },
        ],
        { correlationId: instance.id, causationId: event.eventId },
      );
      continue;
    }

    await fireTransition(workflow, pending, event, instance, deps, tenantId);
  }
}

// Filter a stream to events strictly after the cursor (occurredAt > cursor).
// Same-occurredAt events on different timestamps are rare; the engine falls
// back to a per-event re-dispatch guard (firedTransitionIds) for safety.
function filterAfterCursor(events: DomainEvent[], cursor: string | null): DomainEvent[] {
  if (cursor === null) return events;
  return events.filter((e) => e.occurredAt > cursor);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Silence unused-import warnings for symbols kept for symmetry with Plan 008 §4
// and future engine features (command-initiated flow boot, derived events).
void startLineage;
void followFrom;