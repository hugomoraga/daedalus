// Pure function: resolveJurisdiction (Spec 008 §3.5, task J-07).
// Returns { profile, ruleSets } for the tenant on that date, or null if
// the tenant has opted out (no profile registered). Tenant-scoped: no
// global cache; lookup is always by tenantId.

import type { JurisdictionProfile } from "../../domain/jurisdiction/jurisdiction-profile.ts";
import type { RuleSet } from "../../domain/jurisdiction/rule-set.ts";
import type { JurisdictionPort } from "./ports/jurisdiction-port.ts";
import type { RuleSetLoaderPort } from "./ports/rule-set-loader-port.ts";

export type ResolvedJurisdiction = {
  profile: JurisdictionProfile;
  ruleSets: RuleSet[];
};

export async function resolveJurisdiction(
  jurisdictionPort: JurisdictionPort,
  ruleSetLoader: RuleSetLoaderPort,
  tenantId: string,
  asOf: string,
): Promise<ResolvedJurisdiction | null> {
  const profile = await jurisdictionPort.loadProfile(tenantId, asOf);
  if (profile === null) return null;
  const ruleSets: RuleSet[] = [];
  for (const ref of profile.ruleSets) {
    ruleSets.push(await ruleSetLoader.load(ref, tenantId));
  }
  return { profile, ruleSets };
}

// Convenience: derive a stable, opaque profile ref string from a profile.
// Used by adapters when emitting JurisdictionProfileChanged. Core does not
// interpret the ref; it is opaque.
export function profileRef(profile: JurisdictionProfile): string {
  const sub = profile.jurisdiction.subdivisionCode
    ? `-${profile.jurisdiction.subdivisionCode}`
    : "";
  return `${profile.jurisdiction.countryCode}${sub}`;
}