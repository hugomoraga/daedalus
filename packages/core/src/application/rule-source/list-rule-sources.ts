// Use case: listRuleSourcesUseCase (Spec 010 Plan §3.4, task R-09).
// Returns a structured report of every RuleSet a tenant has registered
// + its provenance status. Used by the `rules:list` CLI command.

import type { CoreDeps } from "@daedalus/core";
import { isStale, type StalenessConfig } from "../../domain/rule-source/staleness.ts";
import type { RuleSourceKind } from "../../domain/jurisdiction/rule-provenance.ts";
import type { RuleSetRegisteredPayload } from "../../domain/rule-source/rule-set-registered.ts";

export type RuleSourceStatus = "ok" | "stale" | "missing";

export type RuleSourceRow = {
  ruleSetId: string;
  version: string;
  effectiveFrom: string;
  sourceKind: RuleSourceKind;
  verifiedBy: string;
  retrievedAt: string;
  ageMonths: number;
  thresholdMonths: number;
  status: RuleSourceStatus;
};

export type ListRuleSourcesResult = {
  rows: RuleSourceRow[];
  scanned: number;
  stale: number;
  ok: number;
  missing: number;
};

export async function listRuleSourcesUseCase(
  deps: CoreDeps,
  config: StalenessConfig,
  input: { tenantId: string; asOf?: Date; fileExists?: (uri: string) => Promise<boolean> },
): Promise<ListRuleSourcesResult> {
  const asOf = input.asOf ?? new Date();
  const events = await deps.eventStore.readStream(input.tenantId);
  const latestByKey = new Map<string, RuleSetRegisteredPayload>();
  for (const event of events) {
    if (event.type !== "RuleSetRegistered") continue;
    const payload = event.payload as unknown as RuleSetRegisteredPayload;
    latestByKey.set(`${payload.ruleSetId}@${payload.version}`, payload);
  }
  const rows: RuleSourceRow[] = [];
  let stale = 0;
  let ok = 0;
  let missing = 0;
  for (const payload of latestByKey.values()) {
    const result = isStale(
      payload.provenance.retrievedAt,
      payload.provenance.sourceKind as RuleSourceKind,
      config,
      asOf,
    );
    let status: RuleSourceStatus = "ok";
    if (input.fileExists !== undefined) {
      const exists = await input.fileExists(payload.obligationsUri);
      if (!exists) {
        status = "missing";
        missing += 1;
      } else if (result.stale) {
        status = "stale";
        stale += 1;
      } else {
        ok += 1;
      }
    } else if (result.stale) {
      status = "stale";
      stale += 1;
    } else {
      ok += 1;
    }
    rows.push({
      ruleSetId: payload.ruleSetId,
      version: payload.version,
      effectiveFrom: payload.effectiveFrom,
      sourceKind: payload.provenance.sourceKind,
      verifiedBy: payload.provenance.verifiedBy,
      retrievedAt: payload.provenance.retrievedAt,
      ageMonths: result.ageMonths,
      thresholdMonths: result.thresholdMonths,
      status,
    });
  }
  return { rows, scanned: rows.length, stale, ok, missing };
}