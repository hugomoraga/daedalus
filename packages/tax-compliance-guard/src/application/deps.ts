// Tax & Compliance Guard (Spec 004 Plan §5, T-04) — Module deps shape.
// Extends CoreDeps with the Module's ports: a RuleSetLoaderPort (to load
// the tenant's registered RuleSets) and a PolicyStorePort (to load the
// tax-compliance-policy bundle via Core's evaluateAndRecordPolicy). The
// Core never depends on this.

import type { CoreDeps, RuleSetLoaderPort, PolicyStorePort } from "@daedalus/core";

export type TaxComplianceDeps = CoreDeps & {
  ruleSetLoader: RuleSetLoaderPort;
  policyStore: PolicyStorePort;
  // Optional clock injection for the deadline sweep (Plan §9 testability).
  // Falls back to deps.now when absent.
  asOf?: () => string;
};
