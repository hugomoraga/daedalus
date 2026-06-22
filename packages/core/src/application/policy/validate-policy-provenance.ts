// Pure function: validatePolicyProvenance (Spec 009 §12, task P-06).
// Mirrors validateProvenance from Spec 008 (RuleProvenance). Rejects policies
// missing any required field. Throws PolicyProvenanceMissing.

import type { Policy, PolicyProvenance } from "../../domain/policy/policy-provenance.ts";
import { PolicyProvenanceMissing } from "./ports/policy-store-port.ts";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function validatePolicyProvenance(policy: Policy): void {
  checkOne(policy.ref.provenance, `Policy(${policy.ref.policyId}@${policy.ref.version}).ref.provenance`);
}

function checkOne(p: PolicyProvenance, label: string): void {
  if (!p.sourceKind) {
    throw new PolicyProvenanceMissing(`${label}.sourceKind missing`);
  }
  if (!p.sourceId || p.sourceId.trim().length === 0) {
    throw new PolicyProvenanceMissing(`${label}.sourceId missing`);
  }
  if (!p.retrievedAt || !ISO_DATE_RE.test(p.retrievedAt)) {
    throw new PolicyProvenanceMissing(`${label}.retrievedAt not ISO date: "${p.retrievedAt}"`);
  }
  if (!p.verifiedBy || p.verifiedBy.trim().length === 0) {
    throw new PolicyProvenanceMissing(`${label}.verifiedBy missing`);
  }
}