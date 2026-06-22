// PolicyStorePort (Spec 009 §9) — read interface for a policy artifact.
// Default impl: FilesystemPolicyStore. InMemoryPolicyStore for tests + Phase 1 default.

import type { Policy, PolicyRef } from "../../../domain/policy/policy.ts";

// Error classes — surfaced by the store and caught by callers.
export class PolicyNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyNotFound";
  }
}

export class PolicyProvenanceMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyProvenanceMissing";
  }
}

export class PolicyVersionMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyVersionMismatch";
  }
}

export interface PolicyStorePort {
  load(ref: PolicyRef, tenantId: string): Promise<Policy>;
}