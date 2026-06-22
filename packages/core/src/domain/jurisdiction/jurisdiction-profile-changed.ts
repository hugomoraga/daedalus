// Domain event: JurisdictionProfileChanged (Spec 008 §5).
// Emitted by the Core when a tenant's jurisdiction profile changes.
// The Core records that a change happened (with provenance) but does NOT
// interpret the profile content — both refs are opaque strings.

import type { RuleProvenance } from "./rule-provenance.ts";

export const JurisdictionProfileChanged = "JurisdictionProfileChanged";

export type JurisdictionProfileChangedPayload = {
  previousProfileRef?: string; // opaque ref to the prior profile
  newProfileRef: string; // opaque ref to the new profile
  provenance: RuleProvenance;
};