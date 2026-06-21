// EngineDeps — everything the engine needs to run. Injected, free of globals.
// Composition roots (engine CLI / tests) build this; the engine consumes it.
//
// Extends CoreDeps (event store, id, clock, actor) with:
//   - policy: the policy decision seam (no-op in v0)
//   - workflowStore: loads workflow artifacts for a tenant
//   - instanceStore: persists instances + engine cursor per tenant
//   - useCases: name → invoker registry (built by the composition root)

import type { CoreDeps } from "@daedalus/core";
import type { PolicyDecisionPort } from "./ports/policy.ts";
import type { WorkflowStorePort } from "./ports/workflow-store.ts";
import type { InstanceStorePort } from "./ports/instance-store.ts";
import type { UseCaseRegistry } from "./use-cases.ts";

export type EngineDeps = CoreDeps & {
  policy: PolicyDecisionPort;
  workflowStore: WorkflowStorePort;
  instanceStore: InstanceStorePort;
  useCases: UseCaseRegistry;
};