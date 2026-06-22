// @daedalus/workflow-engine — explicit public contract.
// ADR-004: no `export *` — curated named exports. Adapters live behind the
// `./adapters` subpath and are NOT re-exported here.

// Domain types
export type {
  StateRef,
  GuardExpr,
  ActionRef,
  Transition,
  State,
  Workflow,
} from "./domain/workflow.ts";
export type { Instance, InstanceStatus, InstanceTransition } from "./domain/instance.ts";

// Engine event vocabulary
export {
  WorkflowInstanceStarted,
  WorkflowTransitionFired,
  WorkflowInstanceCompleted,
  WorkflowInstanceCompensated,
  HumanApprovalRequired,
  HumanApproved,
  HumanRejected,
  ENGINE_EVENT_PREFIXES,
  isEngineEvent,
} from "./domain/engine-events.ts";

// Application — ports & deps (consumed by composition roots)
export type { PolicyDecision, PolicyDecisionPort } from "./application/ports/policy.ts";
export type { WorkflowStorePort } from "./application/ports/workflow-store.ts";
export type { InstanceStorePort } from "./application/ports/instance-store.ts";
export type { UseCaseInvoker, UseCaseRegistry } from "./application/use-cases.ts";
export type { EngineDeps } from "./application/deps.ts";
export type { EngineOptions, EngineHandle } from "./application/engine.ts";

// Policy implementations (v0 no-op + a deny-all test double)
export { noOpPolicy, denyAllPolicy } from "./application/ports/policy.ts";

// Use-case registry factory (builds the registry for Core use cases)
export {
  coreUseCases,
  proposalGenerationUseCases,
  assertRegistryClosed,
  type ProposalGenerationModuleDeps,
} from "./application/use-cases.ts";

// Capturing event store (lets the engine observe events emitted by actions)
export { capturingEventStore, type CapturingEventStore } from "./application/capturing-store.ts";

// Engine loop
export { runEngine } from "./application/engine.ts";

// Pure helpers
export { evaluateGuard } from "./domain/guard.ts";
export { newInstance } from "./domain/instance.ts";
export {
  matchesInitialTrigger,
  evaluateTransitions,
  invokeActions,
  advanceInstance,
  markWaitingHuman,
  markCompleted,
  markCompensated,
} from "./application/transitions.ts";
export { compensate, type CompensationResult } from "./application/compensation.ts";