// Pure function: validateProvenance (Spec 008 Plan §6, task J-06).
// Rejects rule sets whose provenance is missing required fields. Used by
// every loader (and by tests as a static check). Throws RuleSetProvenanceMissing.

import type { RuleProvenance } from "../../domain/jurisdiction/rule-provenance.ts";
import type { RuleSet } from "../../domain/jurisdiction/rule-set.ts";
import { RuleSetProvenanceMissing } from "./ports/rule-set-loader-port.ts";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function validateProvenance(ruleSet: RuleSet): void {
  checkOne(ruleSet.ref.source, `RuleSet(${ruleSet.ref.ruleSetId}@${ruleSet.ref.version}).ref.source`);
  for (const obligation of ruleSet.obligations) {
    checkOne(
      obligation.provenance,
      `RuleSet(${ruleSet.ref.ruleSetId}@${ruleSet.ref.version}).obligation[${obligation.obligationId}].provenance`,
    );
  }
}

function checkOne(p: RuleProvenance, label: string): void {
  if (!p.sourceKind) {
    throw new RuleSetProvenanceMissing(`${label}.sourceKind missing`);
  }
  if (!p.sourceId || p.sourceId.trim().length === 0) {
    throw new RuleSetProvenanceMissing(`${label}.sourceId missing`);
  }
  if (!p.retrievedAt || !ISO_DATE_RE.test(p.retrievedAt)) {
    throw new RuleSetProvenanceMissing(`${label}.retrievedAt not ISO date: "${p.retrievedAt}"`);
  }
  if (!p.verifiedBy || p.verifiedBy.trim().length === 0) {
    throw new RuleSetProvenanceMissing(`${label}.verifiedBy missing`);
  }
}