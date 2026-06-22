// JurisdictionPort (Spec 008 §3.5, Plan §2) — the read interface for
// a tenant's jurisdiction profile. Default impl lives in adapters/jurisdiction/.
//
// The port stores; it does NOT emit events. The use case
// `recordProfileChange` handles event emission via the canonical Core
// pipeline (appendIntents), keeping the port adapter free of Core internals.

import type { JurisdictionProfile } from "../../../domain/jurisdiction/jurisdiction-profile.ts";

export interface JurisdictionPort {
  loadProfile(tenantId: string, asOf: string): Promise<JurisdictionProfile | null>;
  recordProfileChange(input: {
    tenantId: string;
    newProfile: JurisdictionProfile;
  }): Promise<void>;
}