// Use case: recordProfileChange (Spec 008 task J-08).
// Stores the new profile via the port and emits JurisdictionProfileChanged
// via Core's canonical event store. The port adapter stays free of
// Core lineage concerns.

import {
  appendIntents,
  startLineage,
  type CoreDeps,
  type DomainEvent,
} from "@daedalus/core";
import { JurisdictionProfileChanged } from "../../domain/jurisdiction/jurisdiction-profile-changed.ts";
import type { JurisdictionProfile } from "../../domain/jurisdiction/jurisdiction-profile.ts";
import type { RuleProvenance } from "../../domain/jurisdiction/rule-provenance.ts";
import { profileRef } from "./resolve-jurisdiction.ts";
import type { JurisdictionPort } from "./ports/jurisdiction-port.ts";

export async function recordProfileChange(
  deps: CoreDeps,
  port: JurisdictionPort,
  input: {
    tenantId: string;
    actor: string;
    provenance: RuleProvenance;
    newProfile: JurisdictionProfile;
    previousProfileRef?: string;
  },
): Promise<{ event: DomainEvent; newProfileRef: string }> {
  const newProfileRef = profileRef(input.newProfile);
  await port.recordProfileChange({
    tenantId: input.tenantId,
    newProfile: input.newProfile,
  });
  const lineage = startLineage(deps.newId);
  const before = await deps.eventStore.readStream(input.tenantId);
  await appendIntents(
    deps,
    input.tenantId,
    [
      {
        type: JurisdictionProfileChanged,
        payload: {
          previousProfileRef: input.previousProfileRef,
          newProfileRef,
          provenance: input.provenance,
        },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(input.tenantId);
  // Return the most-recently-appended event with the matching type.
  const event = after[after.length - 1];
  if (event === undefined || event.type !== JurisdictionProfileChanged) {
    throw new Error("JurisdictionProfileChanged not found after appendIntents");
  }
  void before;
  return { event, newProfileRef };
}