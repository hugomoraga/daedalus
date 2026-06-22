// Use case: sweepStalenessUseCase (Spec 010 §9.5 + Plan §3.3, task R-08).
// Walks the tenant's RuleSet history (from the event stream), and for
// every registered RuleSet whose retrievedAt exceeds the threshold for
// its sourceKind, emits a RuleSetStale event. Idempotent: re-running
// the sweep emits a new RuleSetStale for each still-stale rule set.

import {
  appendIntents,
  type CoreDeps,
  type DomainEvent,
} from "@daedalus/core";
import { RuleSetStale } from "../../domain/rule-source/rule-set-stale.ts";
import { isStale, type StalenessConfig } from "../../domain/rule-source/staleness.ts";
import type { RuleSourceKind } from "../../domain/jurisdiction/rule-provenance.ts";
import type { RuleSetRegisteredPayload } from "../../domain/rule-source/rule-set-registered.ts";

export type SweepStalenessInput = {
  tenantId: string;
  asOf?: Date; // override for testability
};

export type SweepStalenessResult = {
  events: DomainEvent[];
  scanned: number;
  stale: number;
};

export async function sweepStalenessUseCase(
  deps: CoreDeps,
  config: StalenessConfig,
  input: SweepStalenessInput,
): Promise<SweepStalenessResult> {
  const asOf = input.asOf ?? new Date();
  const events = await deps.eventStore.readStream(input.tenantId);
  // Take the latest registration per (ruleSetId, version).
  const latestByKey = new Map<string, RuleSetRegisteredPayload>();
  for (const event of events) {
    if (event.type !== "RuleSetRegistered") continue;
    const payload = event.payload as unknown as RuleSetRegisteredPayload;
    latestByKey.set(`${payload.ruleSetId}@${payload.version}`, payload);
  }
  const stalePayloads = [];
  let scanned = 0;
  for (const payload of latestByKey.values()) {
    scanned += 1;
    const result = isStale(
      payload.provenance.retrievedAt,
      payload.provenance.sourceKind as RuleSourceKind,
      config,
      asOf,
    );
    if (result.stale) {
      stalePayloads.push({ payload, result });
    }
  }
  if (stalePayloads.length === 0) {
    return { events: [], scanned, stale: 0 };
  }
  // The system (not a human actor) emits RuleSetStale. Per Spec 010 §12.3.
  // We construct a system deps with actor="system" for the emission only.
  const systemDeps: CoreDeps = { ...deps, actor: "system" };
  const before = events.length;
  await appendIntents(
    systemDeps,
    input.tenantId,
    stalePayloads.map(({ payload, result }) => ({
      type: RuleSetStale,
      payload: {
        ruleSetId: payload.ruleSetId,
        version: payload.version,
        sourceKind: payload.provenance.sourceKind,
        retrievedAt: payload.provenance.retrievedAt,
        ageMonths: result.ageMonths,
        thresholdMonths: result.thresholdMonths,
      },
    })),
    { correlationId: deps.newId(), causationId: null },
  );
  const after = await deps.eventStore.readStream(input.tenantId);
  const emitted = after.slice(before);
  return { events: emitted, scanned, stale: emitted.length };
}