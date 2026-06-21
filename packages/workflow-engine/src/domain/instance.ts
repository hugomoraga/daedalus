// Workflow Instance — one execution of a workflow, identified by correlationId.
// Bound to (workflowName, version) at start; the engine never re-binds an
// existing instance to a newer version (Spec 008 §7.6 / AC-6).

import type { DomainEvent } from "@daedalus/core";
import type { StateRef } from "./workflow.ts";

// One row of instance history: a transition that fired and what triggered it.
export type InstanceTransition = {
  transitionId: string;
  fromState: StateRef;
  toState: StateRef;
  firedAt: string;
  triggerEventId: string;
};

// The engine's lifecycle states for an instance.
export type InstanceStatus =
  | "active"
  | "waiting_human"
  | "completed"
  | "compensated";

export type Instance = {
  id: string;
  workflowName: string;
  workflowVersion: string;
  tenantId: string;
  currentState: StateRef;
  status: InstanceStatus;
  firedTransitionIds: string[];
  pendingTransitionId: string | null;
  history: InstanceTransition[];
  startedAt: string;
  updatedAt: string;
  lastSeenEventId: string | null;
};

export type NewInstance = {
  id: string;
  workflowName: string;
  workflowVersion: string;
  tenantId: string;
  initialState: StateRef;
  startedAt: string;
  triggerEvent: DomainEvent;
};

export function newInstance(args: NewInstance): Instance {
  return {
    id: args.id,
    workflowName: args.workflowName,
    workflowVersion: args.workflowVersion,
    tenantId: args.tenantId,
    currentState: args.initialState,
    status: "active",
    firedTransitionIds: [],
    pendingTransitionId: null,
    history: [],
    startedAt: args.startedAt,
    updatedAt: args.startedAt,
    lastSeenEventId: args.triggerEvent.eventId,
  };
}