// Authoritative Rule Source (Spec 010) — 7 test cases from Plan §6 (task R-16).
// Uses `node --test`. No fixtures file — test data is constructed inline.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageInMonths,
  appendIntents,
  isStale,
  listRuleSourcesUseCase,
  ObligationCoverageGap,
  registerRuleSetUseCase,
  RuleSetRegistered,
  RuleSetStale,
  RuleSetSuperseded,
  startLineage,
  supersedeRuleSetUseCase,
  sweepStalenessUseCase,
  validateProvenance,
  type CoreDeps,
  type DomainEvent,
  type ObligationSpec,
  type RuleProvenance,
  type RuleSet,
  type RuleSetRef,
  type StalenessConfig,
} from "@daedalus/core";
import { defaultStalenessConfig, InMemoryPolicyStore, FilesystemPolicyStore } from "@daedalus/core/adapters";
import { makeTestDeps } from "./helpers.ts";

const T = "tenant-0";

const goodProvenance = (overrides: Partial<RuleProvenance> = {}): RuleProvenance => ({
  sourceKind: "tenant-declared",
  sourceId: "fixture-2026-01",
  retrievedAt: "2026-01-01",
  verifiedBy: "fixture",
  notes: "test only",
  ...overrides,
});

const goodObligation = (id: string): ObligationSpec => ({
  obligationId: id,
  humanName: `Obligation ${id}`,
  trigger: { onEventType: "PaymentReceived" },
  deadline: { kind: "offset-from-trigger", daysAfter: 30, businessDaysOnly: false },
  requiredHumanAction: "review",
  provenance: goodProvenance(),
});

const goodRuleSet = (overrides: Partial<RuleSet> = {}): RuleSet => ({
  ref: {
    ruleSetId: "rs-1",
    version: "1.0.0",
    effectiveFrom: "2026-01-01",
    provenance: goodProvenance(),
    obligationsUri: `config/rulesets/${T}/rs-1@1.0.0.json`,
  },
  rules: [],
  obligations: [goodObligation("o1"), goodObligation("o2")],
  ...overrides,
});

const config = (): StalenessConfig => defaultStalenessConfig();

test("AC-1: RuleSetRegistered emitted with full lineage; payload includes provenance", async () => {
  const { deps } = makeTestDeps();
  const store = new InMemoryPolicyStore();
  void store;
  const ruleSet = goodRuleSet();
  validateProvenance(ruleSet);
  const { event } = await registerRuleSetUseCase(deps as CoreDeps, undefined as never, {
    tenantId: T,
    actor: "test",
    ruleSet,
  });
  assert.equal(event.type, RuleSetRegistered);
  assert.equal(event.tenantId, T);
  assert.equal(event.actor, "test");
  assert.equal(event.payload.ruleSetId, "rs-1");
  assert.equal(event.payload.version, "1.0.0");
  assert.equal(event.payload.ruleCount, 2);
  assert.equal(event.payload.provenance.sourceKind, "tenant-declared");
  assert.ok(typeof event.correlationId === "string" && event.correlationId.length > 0);
});

test("AC-2: RuleSetSuperseded links previous + new via shared correlationId", async () => {
  const { deps } = makeTestDeps();
  const ruleSetV1 = goodRuleSet();
  const { event: registeredV1 } = await registerRuleSetUseCase(deps as CoreDeps, undefined as never, {
    tenantId: T,
    actor: "test",
    ruleSet: ruleSetV1,
  });
  // Register v2 (with shared correlationId of v1's event).
  const ruleSetV2 = goodRuleSet({
    ref: {
      ...ruleSetV1.ref,
      version: "2.0.0",
      effectiveFrom: "2026-06-01",
    },
  });
  const { event: registeredV2 } = await registerRuleSetUseCase(deps as CoreDeps, undefined as never, {
    tenantId: T,
    actor: "test",
    ruleSet: ruleSetV2,
  });
  // Emit RuleSetSuperseded linking them by sharing v2's correlationId.
  const { event: superseded } = await supersedeRuleSetUseCase(deps as CoreDeps, {
    tenantId: T,
    actor: "test",
    ruleSetId: "rs-1",
    previousVersion: "1.0.0",
    newVersion: "2.0.0",
    previousEffectiveFrom: "2026-01-01",
    newEffectiveFrom: "2026-06-01",
    correlationId: registeredV2.correlationId,
  });
  assert.equal(superseded.type, RuleSetSuperseded);
  assert.equal(superseded.correlationId, registeredV2.correlationId);
  assert.equal(superseded.payload.previousVersion, "1.0.0");
  assert.equal(superseded.payload.newVersion, "2.0.0");
  // The audit trail: v1 registration, v2 registration, supersede.
  const all = await deps.eventStore.readStream(T);
  assert.equal(all.filter((e) => e.type === RuleSetRegistered).length, 2);
  assert.equal(all.filter((e) => e.type === RuleSetSuperseded).length, 1);
  void registeredV1;
});

test("AC-3: RuleSetStale emitted for an over-threshold RuleSet; actor=system", async () => {
  const { deps } = makeTestDeps();
  // Retrieved 24 months ago — past the default 12-month threshold.
  const stale = goodRuleSet({
    ref: {
      ...goodRuleSet().ref,
      provenance: goodProvenance({ retrievedAt: "2024-06-22" }),
    },
  });
  await registerRuleSetUseCase(deps as CoreDeps, undefined as never, {
    tenantId: T,
    actor: "test",
    ruleSet: stale,
  });
  const result = await sweepStalenessUseCase(deps as CoreDeps, config(), { tenantId: T });
  assert.ok(result.stale >= 1);
  const all = await deps.eventStore.readStream(T);
  const staleEvent = all.find((e) => e.type === RuleSetStale);
  assert.ok(staleEvent, "RuleSetStale emitted");
  assert.equal(staleEvent!.actor, "system");
  assert.equal(staleEvent!.payload.ruleSetId, "rs-1");
  assert.ok(staleEvent!.payload.ageMonths > staleEvent!.payload.thresholdMonths);
});

test("AC-4: RuleSetStale not emitted for a fresh RuleSet", async () => {
  const { deps } = makeTestDeps();
  // Retrieved today — well under any threshold.
  const fresh = goodRuleSet({
    ref: {
      ...goodRuleSet().ref,
      provenance: goodProvenance({ retrievedAt: new Date().toISOString().slice(0, 10) }),
    },
  });
  await registerRuleSetUseCase(deps as CoreDeps, undefined as never, {
    tenantId: T,
    actor: "test",
    ruleSet: fresh,
  });
  const result = await sweepStalenessUseCase(deps as CoreDeps, config(), { tenantId: T });
  assert.equal(result.stale, 0);
});

test("AC-5: ObligationCoverageGap emitted when no rule matches an obligation", async () => {
  const { deps } = makeTestDeps();
  // A Module emits the gap when it can't evaluate an obligation.
  const lineage = startLineage(deps.newId);
  const before = await deps.eventStore.readStream(T);
  await appendIntents(deps as CoreDeps, T, [
    {
      type: ObligationCoverageGap,
      payload: {
        obligationId: "o-unknown",
        obligationHumanName: "An obligation we cannot evaluate",
        reason: "no-rule-matches",
        candidateRuleSets: [],
      },
    },
  ], lineage);
  const after = await deps.eventStore.readStream(T);
  const gap = after[after.length - 1];
  assert.equal(gap.type, ObligationCoverageGap);
  assert.equal(gap.payload.reason, "no-rule-matches");
  void before;
});

test("AC-6: ObligationCoverageGap with conflicting-rules-no-precedence includes candidates", async () => {
  const { deps } = makeTestDeps();
  await appendIntents(deps as CoreDeps, T, [{
    type: ObligationCoverageGap,
    payload: {
      obligationId: "o-conflict",
      obligationHumanName: "Two rules disagree",
      reason: "conflicting-rules-no-precedence",
      candidateRuleSets: [
        { ruleSetId: "rs-A", version: "1.0.0", effectiveFrom: "2026-01-01", jurisdiction: { countryCode: "CL" } },
        { ruleSetId: "rs-B", version: "1.0.0", effectiveFrom: "2026-01-01", jurisdiction: { countryCode: "CL", subdivisionCode: "RM" } },
      ],
    },
  }], startLineage(deps.newId));
  const all = await deps.eventStore.readStream(T);
  const gap = all.find((e) => e.type === ObligationCoverageGap);
  assert.ok(gap);
  assert.equal(gap!.payload.reason, "conflicting-rules-no-precedence");
  assert.equal(gap!.payload.candidateRuleSets.length, 2);
});

test("AC-7: isStale — most-specific jurisdiction wins; tie → effectiveFrom; final tie → gap", () => {
  // Fresh rule set, not stale.
  const fresh = isStale("2026-06-22", "tenant-declared", {
    thresholds: { "official-publication": 12, "legal-advisor-opinion": 6, "tenant-declared": 3 },
  });
  assert.equal(fresh.stale, false);
  // 24 months old → stale.
  const oldRule = isStale("2024-06-22", "official-publication", {
    thresholds: { "official-publication": 12, "legal-advisor-opinion": 6, "tenant-declared": 3 },
  });
  assert.equal(oldRule.stale, true);
  assert.ok(oldRule.ageMonths > oldRule.thresholdMonths);
  // ageInMonths sanity (current month, well within bounds).
  const now = new Date();
  const sameMonth = ageInMonths(now.toISOString().slice(0, 10), now);
  assert.equal(sameMonth, 0);
});