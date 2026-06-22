// Policy Engine (Spec 009) — 8 test cases from Plan §6 (task P-15).
// Uses `node --test`. No fixtures file — test data is constructed inline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultEvaluate,
  evaluateAndRecordPolicy,
  PolicyDecisionRecorded,
  PolicyNotFound,
  PolicyProvenanceMissing,
  PolicyVersionMismatch,
  validatePolicyProvenance,
  type Policy,
  type PolicyAction,
  type PolicyRef,
  type PolicyProvenance,
} from "@daedalus/core";
import { FilesystemPolicyStore, InMemoryPolicyStore } from "@daedalus/core/adapters";
import { makeTestDeps } from "./helpers.ts";

const T = "tenant-0";

const goodProvenance = (): PolicyProvenance => ({
  sourceKind: "tenant-declared",
  sourceId: "fixture-2026-01",
  retrievedAt: "2026-01-01",
  verifiedBy: "fixture",
  notes: "test only",
});

const refOf = (policy: Policy): PolicyRef => policy.ref;

const allowAllPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  ref: {
    policyId: "p-1",
    version: "1.0.0",
    effectiveFrom: "2026-01-01",
    provenance: goodProvenance(),
    rulesUri: `config/policies/${T}/p-1@1.0.0.json`,
  },
  rules: [{ ruleId: "default", match: { always: true }, outcome: "allow", reason: "always-allow" }],
  ...overrides,
});

const action = (overrides: Partial<PolicyAction> = {}): PolicyAction => ({
  actionType: "ObligationMissed",
  tenantId: T,
  actor: "test",
  context: { obligationId: "o1", severity: "high" },
  occurredAt: "2026-06-21T00:00:00.000Z",
  ...overrides,
});

test("AC-default: first-match-wins; no-match → escalate (default-deny)", () => {
  const policyNoDefault: Policy = {
    ref: {
      policyId: "p-x",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: goodProvenance(),
      rulesUri: "config/policies/tenant-0/p-x@1.0.0.json",
    },
    rules: [
      { ruleId: "r1", match: { fieldEquals: { field: "context.severity", value: "low" } }, outcome: "allow" },
    ],
  };
  // severity=low → r1 → allow
  const a1 = defaultEvaluate(policyNoDefault, action({ context: { obligationId: "o1", severity: "low" } }));
  assert.equal(a1.decision.kind, "allow");
  assert.equal(a1.ruleId, "r1");
  // severity=high → no match → default escalate (Constitution §II.3)
  const a2 = defaultEvaluate(policyNoDefault, action({ context: { obligationId: "o1", severity: "high" } }));
  assert.equal(a2.decision.kind, "escalate");
  assert.equal(a2.ruleId, null);
  assert.equal(a2.decision.reason, "no-rule-matched");
  assert.equal(a2.decision.gateRef, "default");
});

test("AC-explicit-default: {always:true} makes the default explicit", () => {
  const policy: Policy = {
    ref: {
      policyId: "p-y",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: goodProvenance(),
      rulesUri: "config/policies/tenant-0/p-y@1.0.0.json",
    },
    rules: [
      { ruleId: "r1", match: { actionType: "X" }, outcome: "deny", reason: "X denied" },
      { ruleId: "default", match: { always: true }, outcome: "allow", reason: "explicit allow" },
    ],
  };
  // Not X → falls through to default → allow (explicit)
  const r = defaultEvaluate(policy, action({ actionType: "Y" }));
  assert.equal(r.decision.kind, "allow");
  assert.equal(r.decision.reason, "explicit allow");
  assert.equal(r.ruleId, "default");
});

test("AC-provenance: validatePolicyProvenance rejects missing verifiedBy", () => {
  const policy = allowAllPolicy({
    ref: {
      policyId: "p-z",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: { ...goodProvenance(), verifiedBy: "" },
      rulesUri: "config/policies/tenant-0/p-z@1.0.0.json",
    },
  });
  assert.throws(() => validatePolicyProvenance(policy), PolicyProvenanceMissing);
});

test("AC-version: FilesystemPolicyStore throws PolicyVersionMismatch", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-pe-"));
  const tenantDir = join(baseDir, "config", "policies", T);
  mkdirSync(tenantDir, { recursive: true });
  writeFileSync(
    join(tenantDir, "p-1@2.0.0.json"),
    JSON.stringify({
      ref: {
        policyId: "p-1",
        version: "2.0.0",
        effectiveFrom: "2026-01-01",
        provenance: goodProvenance(),
      },
      rules: [{ ruleId: "default", match: { always: true }, outcome: "allow" }],
    }),
  );
  const store = new FilesystemPolicyStore(baseDir);
  await assert.rejects(
    () =>
      store.load(
        {
          policyId: "p-1",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          provenance: goodProvenance(),
          rulesUri: `config/policies/${T}/p-1@2.0.0.json`,
        },
        T,
      ),
    PolicyVersionMismatch,
  );
});

test("AC-notfound: FilesystemPolicyStore throws PolicyNotFound for missing file", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-pe-"));
  const store = new FilesystemPolicyStore(baseDir);
  await assert.rejects(
    () =>
      store.load(
        {
          policyId: "missing",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          provenance: goodProvenance(),
          rulesUri: `config/policies/${T}/missing@1.0.0.json`,
        },
        T,
      ),
    PolicyNotFound,
  );
});

test("AC-isolation: InMemoryPolicyStore scoped per tenant — zero cross-leak", async () => {
  const store = new InMemoryPolicyStore();
  const pA = allowAllPolicy({
    ref: {
      policyId: "p-isolation",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: goodProvenance(),
      rulesUri: "config/policies/tenant-A/p-isolation@1.0.0.json",
    },
  });
  store.register("tenant-A", pA);
  const a = await store.load(refOf(pA), "tenant-A");
  assert.ok(a !== undefined);
  await assert.rejects(() => store.load(refOf(pA), "tenant-B"), PolicyProvenanceMissing);
});

test("AC-record: evaluateAndRecordPolicy emits PolicyDecisionRecorded with full lineage", async () => {
  const { deps } = makeTestDeps();
  const store = new InMemoryPolicyStore();
  const policy = allowAllPolicy({
    ref: {
      policyId: "p-rec",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: goodProvenance(),
      rulesUri: `config/policies/${T}/p-rec@1.0.0.json`,
    },
  });
  store.register(T, policy);
  const { decision, ruleId, event } = await evaluateAndRecordPolicy(deps, store, {
    tenantId: T,
    actor: "test",
    policyRef: policy.ref,
    action: action(),
  });
  assert.equal(decision.kind, "allow");
  assert.equal(ruleId, "default");
  assert.equal(event.type, PolicyDecisionRecorded);
  assert.equal(event.tenantId, T);
  assert.equal(event.actor, "test");
  assert.equal(event.payload.policyRef.policyId, "p-rec");
  assert.equal(event.payload.ruleId, "default");
  assert.ok(typeof event.correlationId === "string" && event.correlationId.length > 0);
});

test("AC-filesystem-roundtrip: FilesystemPolicyStore reads the on-disk policy and evaluateAndRecord fires", async () => {
  const { deps } = makeTestDeps();
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-pe-"));
  const tenantDir = join(baseDir, "config", "policies", T);
  mkdirSync(tenantDir, { recursive: true });
  writeFileSync(
    join(tenantDir, "p-rt@1.0.0.json"),
    JSON.stringify({
      ref: {
        policyId: "p-rt",
        version: "1.0.0",
        effectiveFrom: "2026-01-01",
        provenance: goodProvenance(),
      },
      rules: [
        { ruleId: "r1", match: { actionType: "SpecificEvent" }, outcome: "deny", reason: "explicit deny" },
        { ruleId: "default", match: { always: true }, outcome: "allow" },
      ],
    }),
  );
  const store = new FilesystemPolicyStore(baseDir);
  const ref: PolicyRef = {
    policyId: "p-rt",
    version: "1.0.0",
    effectiveFrom: "2026-01-01",
    provenance: goodProvenance(),
    rulesUri: `config/policies/${T}/p-rt@1.0.0.json`,
  };
  // Specific event → r1 → deny
  const r1 = await evaluateAndRecordPolicy(deps, store, {
    tenantId: T,
    actor: "test",
    policyRef: ref,
    action: action({ actionType: "SpecificEvent" }),
  });
  assert.equal(r1.decision.kind, "deny");
  assert.equal(r1.ruleId, "r1");
  // Other event → default allow
  const r2 = await evaluateAndRecordPolicy(deps, store, {
    tenantId: T,
    actor: "test",
    policyRef: ref,
    action: action({ actionType: "OtherEvent" }),
  });
  assert.equal(r2.decision.kind, "allow");
  assert.equal(r2.ruleId, "default");
});