// RuleSetLoaderPort (Spec 008 §3.5, Plan §2) — the read interface for
// a tenant's rule-set content. Default impl reads from config/rulesets/<tenant>/.

import type { RuleSet, RuleSetRef } from "../../../domain/jurisdiction/rule-set.ts";

// Error classes — surfaced by the loader and caught by callers (Module).
// Throwing named errors lets callers distinguish missing-file vs missing-
// provenance vs version-mismatch without parsing strings.
export class RuleSetProvenanceMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleSetProvenanceMissing";
  }
}

export class RuleSetNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleSetNotFound";
  }
}

export class RuleSetVersionMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleSetVersionMismatch";
  }
}

export interface RuleSetLoaderPort {
  load(ruleSetRef: RuleSetRef, tenantId: string): Promise<RuleSet>;
}