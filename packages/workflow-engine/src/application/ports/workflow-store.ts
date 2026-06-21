// WorkflowStorePort — loads workflow artifacts for a tenant. Default artifacts
// live in `blueprints/workflows/*.json`; per-tenant overrides live in
// `config/tenants/<tenant>/workflows.json` (Spec 008 §4 / Plan 008 §1).
// The adapter that reads those is implemented in T-11.

import type { Workflow } from "../../domain/workflow.ts";

export interface WorkflowStorePort {
  loadFor(tenantId: string): Promise<Workflow[]>;
}