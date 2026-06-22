// Tax & Compliance Guard (Spec 004) — 9 acceptance tests (Plan §7, T-14).
// Uses `node --test`. Test data constructed inline; no fixtures file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendIntents,
  InvoiceIssued,
  PaymentReceived,
  startLineage,
  type CoreDeps,
  type DomainEvent,
  type ObligationSpec,
  type Policy,
  type PolicyProvenance,
  type RuleSet,
} from "@daedalus/core";
import {
  acknowledgeObligationUseCase,
  computeDeadline,
  DEFAULT_TAX_COMPLIANCE_POLICY_REF,
  deriveObligationStates,
  listObligationsUseCase,
  ObligationDue,
  ObligationEvaluationRecorded,
  ObligationMet,
  ObligationMissed,
  ObligationNotPending,
  sweepDeadlinesUseCase,
  UnknownObligation,
  watchFinancialEventsUseCase,
  type TaxComplianceDeps,
} from "@daedalus/tax-compliance-guard";
import { FilesystemRuleSetLoaderAdapter, InMemoryPolicyStore } from "@daedalus/core/adapters";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";

const T = "tenant-0";
const OTHER = "tenant-other";

const goodProvenance = (overrides: Partial<PolicyProvenance> = {}): PolicyProvenance => ({
  sourceKind: "tenant-declared",
  sourceId: "fixture-2026-01",
  retrievedAt: "2026-01-01",
  verifiedBy: "fixture",
  notes: "test only",
  ...overrides,
});

const goodObligation = (
  id: string,
  overrides: Partial<ObligationSpec> = {},
): ObligationSpec => ({
  obligationId: id,
  humanName: `Obligation ${id}`,
  trigger: { onEventType: "PaymentReceived" },
  deadline: { kind: "offset-from-trigger", daysAfter: 30, businessDaysOnly: false },
  requiredHumanAction: "review",
  provenance: goodProvenance(),
  ...overrides,
});

const goodRuleSet = (overrides: Partial<RuleSet> = {}): RuleSet => {
  const ref = {
    ruleSetId: "rs-tc-1",
    version: "1.0.0",
    effectiveFrom: "2026-01-01",
    provenance: goodProvenance(),
    obligationsUri: `config/rulesets/${T}/rs-tc-1@1.0.0.json`,
  };
  return {
    ref,
    obligations: [goodObligation("o-vat-monthly")],
    ...overrides,
  };
};

const writeRuleSetToDisk = (baseDir: string, ruleSet: RuleSet): void => {
  const path = join(baseDir, ruleSet.ref.obligationsUri);
  // The path may include directories — make sure they exist.
  const dir = path.substring(0, path.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(ruleSet, null, 2));
};

const allowAllPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  ref: {
    policyId: "tax-compliance",
    version: "1.0.0",
    effectiveFrom: "2026-01-01",
    provenance: goodProvenance(),
    rulesUri: `config/policies/${T}/tax-compliance@1.0.0.json`,
  },
  rules: [{ ruleId: "default-allow", match: { always: true }, outcome: "allow", reason: "always-allow" }],
  ...overrides,
});

const escalateHighSeverityPolicy = (): Policy => ({
  ref: {
    policyId: "tax-compliance",
    version: "1.0.0",
    effectiveFrom: "2026-01-01",
    provenance: goodProvenance(),
    rulesUri: `config/policies/${T}/tax-compliance@1.0.0.json`,
  },
  rules: [
    {
      ruleId: "high-severity-escalate",
      match: { fieldEquals: { field: "context.requiredHumanAction", value: "file" } },
      outcome: "escalate",
      escalateTo: "tax-review",
      reason: "requires human filing review",
    },
  ],
});

// Helper: register a rule set AND write the JSON file so the loader can find it.
async function registerRuleSet(
  deps: TaxComplianceDeps,
  baseDir: string,
  ruleSet: RuleSet,
): Promise<void> {
  writeRuleSetToDisk(baseDir, ruleSet);
  // Emit RuleSetRegistered via Core so the watcher can find it.
  await appendIntents(
    deps,
    T,
    [
      {
        type: "RuleSetRegistered" as const,
        payload: {
          ruleSetId: ruleSet.ref.ruleSetId,
          version: ruleSet.ref.version,
          effectiveFrom: ruleSet.ref.effectiveFrom,
          obligationsUri: ruleSet.ref.obligationsUri,
          ruleCount: ruleSet.obligations.length,
          provenance: ruleSet.ref.provenance,
        },
      },
    ],
    startLineage(deps.newId),
  );
}

function makeTaxComplianceDeps(
  baseDir: string,
  policyStore: InMemoryPolicyStore,
  fixedNow: string,
): TaxComplianceDeps {
  let counter = 0;
  const eventStore = new JsonlEventStoreAdapter(baseDir);
  const coreDeps: CoreDeps = {
    eventStore,
    newId: () => `id-${++counter}`,
    now: () => fixedNow,
    actor: "test",
  };
  return {
    ...coreDeps,
    ruleSetLoader: new FilesystemRuleSetLoaderAdapter(baseDir),
    policyStore,
    asOf: () => fixedNow,
  };
}

test("AC-1: PaymentReceived + matching obligation → ObligationDue with computed dueAt", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  await registerRuleSet(deps, baseDir, goodRuleSet());

  // Synthesize a PaymentReceived event with full lineage (the watcher
  // reads from the stream; we append a real event).
  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [
      {
        type: PaymentReceived,
        payload: { paymentId: "p-1", proposalId: "pr-1", invoiceId: "inv-1", amount: 100000 },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const paymentEvent = after[after.length - 1];
  assert.ok(paymentEvent !== undefined);
  assert.equal(paymentEvent.type, PaymentReceived);

  const watch = await watchFinancialEventsUseCase(deps, {
    trigger: paymentEvent as DomainEvent,
    actor: "test",
  });
  assert.equal(watch.matched, 1);
  assert.equal(watch.obligations[0]?.obligationId, "o-vat-monthly");

  const stream = await deps.eventStore.readStream(T);
  const due = stream.find((e) => e.type === ObligationDue);
  assert.ok(due !== undefined, "ObligationDue emitted");
  // dueAt = trigger.occurredAt + 30 days
  const expected = new Date("2026-06-22T00:00:00.000Z").getTime() + 30 * 86_400_000;
  assert.equal(due!.payload.dueAt, new Date(expected).toISOString());
  assert.equal(due!.payload.ruleSetId, "rs-tc-1");
  assert.equal(due!.payload.ruleSetVersion, "1.0.0");
});

test("AC-2: pending obligation past dueAt → ObligationMissed (idempotent)", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  // Fixed clock: well AFTER the obligation's dueAt (30 days after trigger).
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-09-01T00:00:00.000Z");
  await registerRuleSet(deps, baseDir, goodRuleSet());

  // Synthesize PaymentReceived (trigger at "now").
  const triggerTime = deps.now();
  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [
      {
        type: PaymentReceived,
        payload: { paymentId: "p-1", proposalId: "pr-1", invoiceId: "inv-1", amount: 100000 },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const paymentEvent = after[after.length - 1] as DomainEvent;
  // Backdate the trigger so dueAt is in the past.
  paymentEvent.occurredAt = "2026-01-01T00:00:00.000Z";

  await watchFinancialEventsUseCase(deps, { trigger: paymentEvent, actor: "test" });

  // The obligation dueAt is 2026-01-31 (30 days later); clock is 2026-09-01.
  const sweep1 = await sweepDeadlinesUseCase(deps, { tenantId: T, actor: "test" });
  assert.equal(sweep1.missed, 1);
  assert.deepEqual(sweep1.missedObligationIds, ["o-vat-monthly"]);

  // Re-running the sweep is idempotent: no new ObligationMissed emitted.
  const sweep2 = await sweepDeadlinesUseCase(deps, { tenantId: T, actor: "test" });
  assert.equal(sweep2.missed, 0);

  const stream = await deps.eventStore.readStream(T);
  const missedCount = stream.filter((e) => e.type === ObligationMissed).length;
  assert.equal(missedCount, 1);
  void triggerTime;
});

test("AC-3: obligations:ack → ObligationMet (and re-ack throws ObligationNotPending)", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  await registerRuleSet(deps, baseDir, goodRuleSet());

  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [
      {
        type: PaymentReceived,
        payload: { paymentId: "p-1", proposalId: "pr-1", invoiceId: "inv-1", amount: 100000 },
      },
    ],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const paymentEvent = after[after.length - 1] as DomainEvent;
  await watchFinancialEventsUseCase(deps, { trigger: paymentEvent, actor: "test" });

  // Ack the obligation.
  const ack = await acknowledgeObligationUseCase(deps, {
    tenantId: T,
    obligationId: "o-vat-monthly",
    dueEventId: paymentEvent.eventId,
    actor: "test",
    notes: "filed via SII",
  });
  assert.equal(ack.event.type, ObligationMet);
  assert.equal(ack.event.payload.obligationId, "o-vat-monthly");
  assert.equal(ack.event.payload.actor, "test");
  assert.equal(ack.event.payload.notes, "filed via SII");

  // Re-ack throws ObligationNotPending.
  await assert.rejects(
    () =>
      acknowledgeObligationUseCase(deps, {
        tenantId: T,
        obligationId: "o-vat-monthly",
        dueEventId: paymentEvent.eventId,
        actor: "test",
      }),
    (err: unknown) => err instanceof ObligationNotPending,
  );

  // Acking an unknown obligation throws UnknownObligation.
  await assert.rejects(
    () =>
      acknowledgeObligationUseCase(deps, {
        tenantId: T,
        obligationId: "o-does-not-exist",
        dueEventId: paymentEvent.eventId,
        actor: "test",
      }),
    (err: unknown) => err instanceof UnknownObligation,
  );
});

test("AC-4: tax-compliance-policy with allow rule → ObligationEvaluationRecorded outcome=allow", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  await registerRuleSet(deps, baseDir, goodRuleSet());

  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [{ type: PaymentReceived, payload: { paymentId: "p-1", invoiceId: "inv-1", amount: 100000 } }],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const paymentEvent = after[after.length - 1] as DomainEvent;

  await watchFinancialEventsUseCase(deps, { trigger: paymentEvent, actor: "test" });

  const stream = await deps.eventStore.readStream(T);
  const evalEvent = stream.find((e) => e.type === ObligationEvaluationRecorded);
  assert.ok(evalEvent !== undefined);
  assert.equal(evalEvent!.payload.outcome, "allow");
  assert.equal(evalEvent!.payload.reason, "always-allow");
  assert.equal(evalEvent!.payload.ruleId, "default-allow");
  assert.deepEqual(evalEvent!.payload.policyRef, {
    policyId: "tax-compliance",
    version: "1.0.0",
  });
});

test("AC-5: tax-compliance-policy with escalate rule → outcome=escalate + gateRef", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, escalateHighSeverityPolicy());
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  // Override the obligation to requiredHumanAction: "file" so the
  // escalate rule matches.
  await registerRuleSet(
    deps,
    baseDir,
    goodRuleSet({
      obligations: [
        goodObligation("o-vat-monthly", { requiredHumanAction: "file" }),
      ],
    }),
  );

  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [{ type: PaymentReceived, payload: { paymentId: "p-1", invoiceId: "inv-1", amount: 100000 } }],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const paymentEvent = after[after.length - 1] as DomainEvent;

  await watchFinancialEventsUseCase(deps, { trigger: paymentEvent, actor: "test" });

  const stream = await deps.eventStore.readStream(T);
  const evalEvent = stream.find((e) => e.type === ObligationEvaluationRecorded);
  assert.ok(evalEvent !== undefined);
  assert.equal(evalEvent!.payload.outcome, "escalate");
  assert.equal(evalEvent!.payload.gateRef, "tax-review");
  assert.equal(evalEvent!.payload.ruleId, "high-severity-escalate");
});

test("AC-6: no policy bundle → default allow + reason=no-policy-bundle + policyRef=null", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  // Note: policyStore is empty — no policy registered.
  const policyStore = new InMemoryPolicyStore();
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  await registerRuleSet(deps, baseDir, goodRuleSet());

  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [{ type: PaymentReceived, payload: { paymentId: "p-1", invoiceId: "inv-1", amount: 100000 } }],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const paymentEvent = after[after.length - 1] as DomainEvent;

  const watch = await watchFinancialEventsUseCase(deps, { trigger: paymentEvent, actor: "test" });
  assert.equal(watch.matched, 1);
  assert.equal(watch.obligations[0]?.evaluation.outcome, "allow");
  assert.equal(watch.obligations[0]?.evaluation.reason, "no-policy-bundle");
  assert.equal(watch.obligations[0]?.evaluation.policyRef, null);

  const stream = await deps.eventStore.readStream(T);
  const evalEvent = stream.find((e) => e.type === ObligationEvaluationRecorded);
  assert.ok(evalEvent !== undefined);
  assert.equal(evalEvent!.payload.outcome, "allow");
  assert.equal(evalEvent!.payload.reason, "no-policy-bundle");
  assert.equal(evalEvent!.payload.policyRef, null);
});

test("AC-7: no matching obligation → ObligationCoverageGap", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  // RuleSet has obligation on PaymentReceived — but the trigger will be InvoiceIssued.
  await registerRuleSet(deps, baseDir, goodRuleSet());

  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [{ type: InvoiceIssued, payload: { invoiceId: "inv-1", projectId: "proj-1", amount: 100000 } }],
    lineage,
  );
  const after = await deps.eventStore.readStream(T);
  const triggerEvent = after[after.length - 1] as DomainEvent;

  const watch = await watchFinancialEventsUseCase(deps, { trigger: triggerEvent, actor: "test" });
  assert.equal(watch.matched, 0);
  assert.ok(watch.coverageGap !== null);
  assert.equal(watch.coverageGap!.reason, "no-rule-matches");

  const stream = await deps.eventStore.readStream(T);
  const gap = stream.find((e) => e.type === "ObligationCoverageGap");
  assert.ok(gap !== undefined);
  assert.equal(gap!.payload.reason, "no-rule-matches");
  // The gap lineage follows the trigger.
  assert.equal(gap!.causationId, triggerEvent.eventId);
});

test("AC-8: tenant isolation — cross-tenant lookups return nothing", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  // Note: do NOT register for OTHER.
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  // Register rule set ONLY for T (the loader enforces tenant scoping).
  await registerRuleSet(deps, baseDir, goodRuleSet());

  // Trigger a financial event on the OTHER tenant.
  const otherLineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    OTHER,
    [{ type: PaymentReceived, payload: { paymentId: "p-2", invoiceId: "inv-2", amount: 100000 } }],
    otherLineage,
  );
  const otherStream = await deps.eventStore.readStream(OTHER);
  const otherPayment = otherStream[otherStream.length - 1] as DomainEvent;

  // Watch for OTHER — should emit a coverage gap with no candidates.
  const watch = await watchFinancialEventsUseCase(deps, { trigger: otherPayment, actor: "test" });
  assert.equal(watch.matched, 0);
  assert.ok(watch.coverageGap !== null);

  // OTHER's stream has ONLY the PaymentReceived + ObligationCoverageGap;
  // no ObligationDue for cross-tenant.
  const onlyOther = await deps.eventStore.readStream(OTHER);
  const dueOnOther = onlyOther.find((e) => e.type === ObligationDue);
  assert.equal(dueOnOther, undefined);

  // T's list is empty too (its stream has only RuleSetRegistered).
  const list = await listObligationsUseCase(deps, { tenantId: T });
  assert.equal(list.obligations.length, 0);
});

test("AC-9: replay determinism — same event stream → same obligation events in same order", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const policyStore = new InMemoryPolicyStore();
  policyStore.register(T, allowAllPolicy());
  const deps = makeTaxComplianceDeps(baseDir, policyStore, "2026-06-22T00:00:00.000Z");
  await registerRuleSet(deps, baseDir, goodRuleSet());

  // Synthesize 3 PaymentReceived events.
  const lineage = startLineage(deps.newId);
  await appendIntents(
    deps,
    T,
    [
      { type: PaymentReceived, payload: { paymentId: "p-1", invoiceId: "inv-1", amount: 100000 } },
      { type: PaymentReceived, payload: { paymentId: "p-2", invoiceId: "inv-2", amount: 200000 } },
      { type: PaymentReceived, payload: { paymentId: "p-3", invoiceId: "inv-3", amount: 300000 } },
    ],
    lineage,
  );

  // Run the watcher over each PaymentReceived in order.
  const stream1 = await deps.eventStore.readStream(T);
  const payments1 = stream1.filter((e) => e.type === PaymentReceived);
  for (const ev of payments1) {
    await watchFinancialEventsUseCase(deps, { trigger: ev, actor: "test" });
  }

  // Re-read the stream and capture the ObligationDue sequence.
  const streamAfter = await deps.eventStore.readStream(T);
  const dues1 = streamAfter
    .filter((e) => e.type === ObligationDue)
    .map((e) => ({
      triggerEventId: e.payload.triggerEventId,
      dueAt: e.payload.dueAt,
      correlationId: e.correlationId,
      causationId: e.causationId,
    }));

  // Replay by clearing the stream and re-running the same operations
  // on a fresh deps (same fixed clock).
  const baseDir2 = mkdtempSync(join(tmpdir(), "daedalus-tc-"));
  const deps2 = makeTaxComplianceDeps(baseDir2, policyStore, "2026-06-22T00:00:00.000Z");
  await registerRuleSet(deps2, baseDir2, goodRuleSet());
  const lineage2 = startLineage(deps2.newId);
  await appendIntents(
    deps2,
    T,
    [
      { type: PaymentReceived, payload: { paymentId: "p-1", invoiceId: "inv-1", amount: 100000 } },
      { type: PaymentReceived, payload: { paymentId: "p-2", invoiceId: "inv-2", amount: 200000 } },
      { type: PaymentReceived, payload: { paymentId: "p-3", invoiceId: "inv-3", amount: 300000 } },
    ],
    lineage2,
  );
  const stream2 = await deps2.eventStore.readStream(T);
  const payments2 = stream2.filter((e) => e.type === PaymentReceived);
  for (const ev of payments2) {
    await watchFinancialEventsUseCase(deps2, { trigger: ev, actor: "test" });
  }
  const dues2 = (await deps2.eventStore.readStream(T))
    .filter((e) => e.type === ObligationDue)
    .map((e) => ({
      triggerEventId: e.payload.triggerEventId,
      dueAt: e.payload.dueAt,
      correlationId: e.correlationId,
      causationId: e.causationId,
    }));

  // Replay: same triggerEventIds in same order, same dueAt, lineage differs
  // (correlationId is generated per `startLineage` call) but the
  // obligation-event sequence is the same.
  assert.equal(dues1.length, dues2.length);
  assert.equal(dues1.length, 3);
  for (let i = 0; i < dues1.length; i++) {
    assert.equal(dues1[i]!.triggerEventId, dues2[i]!.triggerEventId);
    assert.equal(dues1[i]!.dueAt, dues2[i]!.dueAt);
    assert.equal(dues1[i]!.causationId, dues2[i]!.causationId);
  }
});

// Bonus sanity: the pure helper `computeDeadline` is used by the watcher
// and the state-derivation function is reusable.
test("sanity: computeDeadline + deriveObligationStates produce stable results", () => {
  const due = computeDeadline(
    { kind: "offset-from-trigger", daysAfter: 30, businessDaysOnly: false },
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(due, "2026-01-31T00:00:00.000Z");

  const events: DomainEvent[] = [
    {
      eventId: "e1",
      type: ObligationDue,
      tenantId: T,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actor: "test",
      causationId: null,
      correlationId: "c1",
      payload: {
        obligationId: "o1",
        obligationHumanName: "n",
        triggerEventId: "e1",
        triggerEventType: "PaymentReceived",
        dueAt: "2026-01-31T00:00:00.000Z",
        ruleSetId: "rs",
        ruleSetVersion: "1.0.0",
        requiredHumanAction: "review",
        provenance: goodProvenance(),
      },
    },
  ];
  const states = deriveObligationStates(events, "2026-02-15T00:00:00.000Z");
  assert.equal(states.length, 1);
  assert.equal(states[0]!.status, "missed");
});

// Silence unused imports kept for future use-case tests that compose
// the value chain + the broader Module contract.
void DEFAULT_TAX_COMPLIANCE_POLICY_REF;
