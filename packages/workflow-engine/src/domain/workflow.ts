// Workflow Engine — declarative orchestration of value-chain transitions.
// Implements Spec 008. Pure types: a workflow is a versioned JSON artifact;
// an instance is a per-tenant execution bound to (workflowName, version).

// State ref = a string key into the workflow's `states` map.
export type StateRef = string;

// A transition's guard — a small, pure predicate over the triggering event
// and the instance state. v0 supports a tagged union; richer DSLs are future.
export type GuardExpr =
  | { kind: "always" }
  | { kind: "payloadEquals"; field: string; value: unknown }
  | { kind: "stateIn"; states: StateRef[] };

// Reference to a registered use case. The engine resolves `useCase` by name
// against EngineDeps.useCases at boot; mismatches fail closed.
export type ActionRef = {
  useCase: string;
  args: Record<string, unknown>;
};

// A transition in a workflow's state graph.
export type Transition = {
  id: string;
  target: StateRef;
  guard?: GuardExpr;
  requiresHuman?: boolean;
  actions?: ActionRef[];
  compensate?: ActionRef;
  emitAfter?: string[];
};

// A state in the workflow's state graph. `on` maps event type to the
// transitions to evaluate when that event arrives.
export type State = {
  on: Record<string, Transition[]>;
};

// A workflow artifact — versioned JSON, immutable once loaded.
export type Workflow = {
  name: string;
  version: string;
  initial: StateRef;
  terminal: StateRef[];
  states: Record<StateRef, State>;
  contexts: Record<string, string>;
};