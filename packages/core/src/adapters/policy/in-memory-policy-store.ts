// InMemoryPolicyStore (Spec 009 task P-09) — Map-backed store for tests
// and Phase 1 default. Stores policies by tenantId+policyId+version.

import type { Policy, PolicyRef } from "../../domain/policy/policy.ts";
import {
  PolicyProvenanceMissing,
  PolicyVersionMismatch,
  type PolicyStorePort,
} from "../../application/policy/ports/policy-store-port.ts";
import { validatePolicyProvenance } from "../../application/policy/validate-policy-provenance.ts";

export class InMemoryPolicyStore implements PolicyStorePort {
  #store = new Map<string, Policy>();

  #key(tenantId: string, ref: PolicyRef): string {
    return `${tenantId}::${ref.policyId}@${ref.version}`;
  }

  async load(ref: PolicyRef, tenantId: string): Promise<Policy> {
    const policy = this.#store.get(this.#key(tenantId, ref));
    if (policy === undefined) {
      throw new PolicyProvenanceMissing(`policy not found: ${ref.policyId}@${ref.version} for ${tenantId}`);
    }
    if (policy.ref.version !== ref.version) {
      throw new PolicyVersionMismatch(
        `policy version mismatch: ref=${ref.version} stored=${policy.ref.version}`,
      );
    }
    validatePolicyProvenance(policy);
    return policy;
  }

  // Helper for tests: register a policy under a tenant.
  register(tenantId: string, policy: Policy): void {
    this.#store.set(this.#key(tenantId, policy.ref), policy);
  }
}