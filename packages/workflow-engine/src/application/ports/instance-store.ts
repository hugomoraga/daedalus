// InstanceStorePort — the engine's own per-tenant persistence (Spec 008 §4).
// Stores workflow instances + the engine's last-seen cursor. The JSONL adapter
// that backs this in T-12 writes to `.data/tenants/<tenant>/workflow-instances.jsonl`
// (gitignored).

import type { Instance } from "../../domain/instance.ts";

export interface InstanceStorePort {
  findByCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<Instance | null>;
  save(tenantId: string, instance: Instance): Promise<void>;
  // The engine's polling cursor — last observed `occurredAt` on the stream.
  getCursor(tenantId: string): Promise<string | null>;
  setCursor(tenantId: string, occurredAt: string): Promise<void>;
}