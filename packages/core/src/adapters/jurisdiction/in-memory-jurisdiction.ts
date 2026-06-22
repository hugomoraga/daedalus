// InMemoryJurisdictionAdapter (Spec 008 Plan §1, task J-09) — the default
// adapter for Phase 1 + tests. Stores profiles in a per-tenant Map.
// Does not emit events — that is the use case's job
// (`recordProfileChange` in application/jurisdiction/), keeping the port
// adapter free of Core lineage concerns.

import type { JurisdictionProfile } from "../../domain/jurisdiction/jurisdiction-profile.ts";
import type { JurisdictionPort } from "../../application/jurisdiction/ports/jurisdiction-port.ts";

export class InMemoryJurisdictionAdapter implements JurisdictionPort {
  #store = new Map<string, JurisdictionProfile>();

  async loadProfile(tenantId: string, asOf: string): Promise<JurisdictionProfile | null> {
    const profile = this.#store.get(tenantId);
    if (profile === undefined) return null;
    // If the profile declares an effectiveFrom in the future relative to
    // `asOf`, treat the tenant as opted-out at that date.
    if (profile.effectiveFrom !== undefined && asOf < profile.effectiveFrom) {
      return null;
    }
    return profile;
  }

  async recordProfileChange(input: {
    tenantId: string;
    newProfile: JurisdictionProfile;
  }): Promise<void> {
    this.#store.set(input.tenantId, input.newProfile);
  }
}