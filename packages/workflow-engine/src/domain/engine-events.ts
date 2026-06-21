// Engine event vocabulary (Spec 008 §6). These are emitted by the engine into
// the same tenant stream as value-chain events. They follow the lineage discipline
// (ADR-004): correlationId = workflow instance id; causationId = the event that
// triggered the transition (or the human's CLI action).

export const WorkflowInstanceStarted = "WorkflowInstanceStarted";
export const WorkflowTransitionFired = "WorkflowTransitionFired";
export const WorkflowInstanceCompleted = "WorkflowInstanceCompleted";
export const WorkflowInstanceCompensated = "WorkflowInstanceCompensated";
export const HumanApprovalRequired = "HumanApprovalRequired";
export const HumanApproved = "HumanApproved";
export const HumanRejected = "HumanRejected";

// Prefix used to detect engine-originated events at a glance. The engine
// processes every event but only value-chain types trigger transitions;
// engine events fall through (no workflow matches them).
export const ENGINE_EVENT_PREFIXES = ["Workflow", "Human"] as const;

export function isEngineEvent(type: string): boolean {
  return ENGINE_EVENT_PREFIXES.some((p) => type.startsWith(p));
}