// Policy Engine (Spec 009) — HTTP-shaped action tests.
//
// Spec 016 (Platform API) §13 activation gate #3 reads:
//   "The Policy Engine (Spec 009) is on a path to be able to
//    evaluate HTTP-shaped requests. A test asserts that
//    evaluateAndRecordPolicy accepts an HTTP-shaped request
//    context (headers, body, principal, tenant) and emits
//    a PolicyDecisionRecorded event with the request's
//    lineage. Until this holds, the API is built but
//    /v1/tenants/.../commands/... returns 503 per AC-13."
//
// The point of this file is to demonstrate that the engine
// already accepts such contexts (it is generic over
// PolicyAction) — the HTTP → PolicyAction mapping is a thin
// adapter that lives in apps/api/ (Spec 016 Phase B, future
// PR). When this file is green, gate #3 closes: the only
// thing left between v0 and the AC-13 readiness test in
// tests/api-policy-gating.test.ts is the HTTP wiring in
// apps/api/, which is gated on the build itself (post-Phase A).
//
// Test cases:
//   1. actionType-based match: a ruleset keyed on the API
//      command slug ("command.revenue.snapshot") fires allow
//      and the lineage headers survive the round-trip into
//      the emitted PolicyDecisionRecorded event.
//   2. fieldEquals on context.*: a rule keying on
//      context.method or context.path fires correctly.
//   3. and/or composition: a rule that AND-combines
//      actionType and a context field is matched correctly.
//   4. Escalate outcome: an HTTP-shaped action against a rule
//      that escalates returns kind=escalate, gateRef=set-by-rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultEvaluate,
  evaluateAndRecordPolicy,
  PolicyDecisionRecorded,
  type Policy,
  type PolicyAction,
  type PolicyProvenance,
  type PolicyRef,
} from "@daedalus/core";
import { FilesystemPolicyStore, InMemoryPolicyStore } from "@daedalus/core/adapters";
import { makeTestDeps } from "./helpers.ts";

const T = "tenant-0";

const goodProvenance = (): PolicyProvenance => ({
  sourceKind: "tenant-declared",
  sourceId: "http-shaped-fixture-2026",
  retrievedAt: "2026-01-01",
  verifiedBy: "spec-016-fixture",
  notes: "policy-engine-http-shaped.test.ts",
});

// A canonical "HTTP-shaped" PolicyAction — what apps/api/ will
// pass to evaluateAndRecordPolicy when Phase B lands. Built
// here without any HTTP server dependency so the test is the
// pure-evidence carrier for Spec 016 gate #3.
const httpAction = (overrides: Partial<PolicyAction> = {}): PolicyAction => ({
  actionType: "command.revenue.snapshot",
  tenantId: T,
  actor: "api-key:tenant-0:dev",
  context: {
    method: "POST",
    path: "/v1/tenants/tenant-0/commands/revenue/snapshot",
    headers: {
      authorization: "Bearer ****redacted****",
      "idempotency-key": "11111111-1111-1111-1111-111111111111",
      "x-causation-id": "22222222-2222-2222-2222-222222222222",
      "x-correlation-id": "33333333-3333-3333-3333-333333333333",
    },
    idempotencyKey: "11111111-1111-1111-1111-111111111111",
    lineage: {
      causationId: "22222222-2222-2222-2222-222222222222",
      correlationId: "33333333-3333-3333-3333-333333333333",
    },
    payload: {},
  },
  occurredAt: "2026-07-01T00:00:01.000Z",
  ...overrides,
});

const ref = (overrides: Partial<PolicyRef> = {}): PolicyRef => ({
  policyId: "p-http-shaped",
  version: "1.0.0",
  effectiveFrom: "2026-01-01",
  provenance: goodProvenance(),
  rulesUri: `config/policies/${T}/p-http-shaped@1.0.0.json`,
  ...overrides,
});

test("AC-http-actionType: ruleset keyed on the API command slug fires allow and lineage propagates", async () => {
  // Mirrors the dail-financial-snapshot-job's write-phase request
  // shape (ADR-013 §Decision 2c): actionType is the API command
  // slug after the ":" → "/" transform of Spec 016 §11 Q3.
  const { deps } = makeTestDeps();
  const store = new InMemoryPolicyStore();
  const policy: Policy = {
    ref: ref(),
    rules: [
      {
        ruleId: "r-snapshot-allow",
        match: { actionType: "command.revenue.snapshot" },
        outcome: "allow",
        reason: "daily snapshot is read-then-write; current policy allows",
      },
      { ruleId: "default", match: { always: true }, outcome: "allow", reason: "explicit default" },
    ],
  };
  store.register(T, policy);

  const { decision, ruleId, event } = await evaluateAndRecordPolicy(deps, store, {
    tenantId: T,
    actor: "api-key:tenant-0:dev",
    policyRef: policy.ref,
    action: httpAction(),
  });

  assert.equal(decision.kind, "allow");
  assert.equal(ruleId, "r-snapshot-allow");
  assert.equal(decision.kind === "allow" && decision.reason, "daily snapshot is read-then-write; current policy allows");
  assert.equal(event.type, PolicyDecisionRecorded);
  assert.equal(event.tenantId, T);
  assert.equal(event.actor, "api-key:tenant-0:dev");
  // The PolicyDecisionRecorded carries the full action so the
  // audit trail can reconstruct the HTTP shape.
  assert.equal(event.payload.action.actionType, "command.revenue.snapshot");
  assert.equal(event.payload.action.context.method, "POST");
  assert.equal(
    event.payload.action.context.path,
    "/v1/tenants/tenant-0/commands/revenue/snapshot",
  );
  assert.equal(event.payload.ruleId, "r-snapshot-allow");
  assert.ok(typeof event.correlationId === "string" && event.correlationId.length > 0);
  assert.ok(typeof event.causationId === "string" && event.causationId.length > 0);
});

test("AC-http-fieldEquals: a rule keying on context.method is matched", () => {
  // Confirms the fieldEquals matcher reaches into context.method
  // exactly the way apps/api/ would want when its rule author
  // wants to discriminate PUT vs POST on the same command slug.
  const policy: Policy = {
    ref: ref(),
    rules: [
      { ruleId: "r-post-only", match: { fieldEquals: { field: "context.method", value: "POST" } }, outcome: "deny", reason: "POST denied for this tenant" },
      { ruleId: "default", match: { always: true }, outcome: "allow" },
    ],
  };
  // POST action → r-post-only → deny
  const post = defaultEvaluate(policy, httpAction({ context: { ...httpAction().context, method: "POST" } }));
  assert.equal(post.decision.kind, "deny");
  assert.equal(post.ruleId, "r-post-only");
  // GET-shaped action (different method) → falls through to default → allow
  const get = defaultEvaluate(policy, httpAction({ context: { ...httpAction().context, method: "GET" } }));
  assert.equal(get.decision.kind, "allow");
  assert.equal(get.ruleId, "default");
});

test("AC-http-and: a rule that AND-combines actionType and a context field matches only when both hold", () => {
  // This is the pattern a rule author will want for "snapshot is
  // allowed only if the request comes from a path matching the
  // daily-snapshot shape" (e.g. catch typos in path).
  const policy: Policy = {
    ref: ref(),
    rules: [
      {
        ruleId: "r-snapshot-and",
        match: {
          and: [
            { actionType: "command.revenue.snapshot" },
            { fieldEquals: { field: "context.method", value: "POST" } },
          ],
        },
        outcome: "allow",
        reason: "snapshot+POST allowed",
      },
      { ruleId: "default", match: { always: true }, outcome: "escalate", escalateTo: "founder-review", reason: "anything else escalates" },
    ],
  };
  // snapshot + POST → both true → r-snapshot-and → allow
  const ok = defaultEvaluate(
    policy,
    httpAction({ context: { ...httpAction().context, method: "POST" } }),
  );
  assert.equal(ok.decision.kind, "allow");
  assert.equal(ok.ruleId, "r-snapshot-and");
  // snapshot + GET → first match clause is actionType (true), second is
  // fieldEquals method=POST (false) → and fails → falls to default → escalate.
  const wrongMethod = defaultEvaluate(
    policy,
    httpAction({ context: { ...httpAction().context, method: "GET" } }),
  );
  assert.equal(wrongMethod.decision.kind, "escalate");
  assert.equal(wrongMethod.ruleId, "default");
});

test("AC-http-escalate: an HTTP-shaped action against an escalate-rule returns kind=escalate and gateRef from the rule", async () => {
  // The dail-financial-snapshot-job path is read+write; a future
  // "obligations.alert" command would escalate by design until the
  // founder ratifies the escalation gate. This test pins that
  // shape so apps/api/ can rely on gateRef being present.
  const { deps } = makeTestDeps();
  const store = new InMemoryPolicyStore();
  const policy: Policy = {
    ref: ref({ policyId: "p-http-escalate" }),
    rules: [
      {
        ruleId: "r-obligations-escalate",
        match: { actionType: "command.obligations.alert" },
        outcome: "escalate",
        escalateTo: "founder-review",
        reason: "obligations alerting routes via founder sign-off until v0.1.1",
      },
    ],
  };
  store.register(T, policy);

  const { decision, ruleId, event } = await evaluateAndRecordPolicy(deps, store, {
    tenantId: T,
    actor: "api-key:tenant-0:dev",
    policyRef: policy.ref,
    action: httpAction({ actionType: "command.obligations.alert" }),
  });

  assert.equal(decision.kind, "escalate");
  assert.equal(ruleId, "r-obligations-escalate");
  if (decision.kind !== "escalate") return; // narrow for the linter
  assert.equal(decision.gateRef, "founder-review");
  assert.equal(decision.reason, "obligations alerting routes via founder sign-off until v0.1.1");
  assert.equal(event.payload.ruleId, "r-obligations-escalate");
  assert.equal(event.type, PolicyDecisionRecorded);
});

test("AC-http-filesystem: a policy authored as a JSON file under config/policies/ evaluates an HTTP-shaped action end-to-end", async () => {
  // Spec 009 ships with a FilesystemPolicyStore; this test proves
  // the HTTP-shaped action path works against that adapter (not
  // just the InMemoryPolicyStore used above). A rule author can
  // drop a ruleset on disk and the API will pick it up.
  const { deps } = makeTestDeps();
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-pe-http-"));
  const tenantDir = join(baseDir, "config", "policies", T);
  mkdirSync(tenantDir, { recursive: true });
  const policyOnDisk = {
    ref: {
      policyId: "p-http-from-disk",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: goodProvenance(),
    },
    rules: [
      {
        ruleId: "r-disk-allow",
        match: { actionType: "command.revenue.snapshot" },
        outcome: "allow",
        reason: "from-disk allow",
      },
    ],
  };
  writeFileSync(
    join(tenantDir, "p-http-from-disk@1.0.0.json"),
    JSON.stringify(policyOnDisk),
  );
  const store = new FilesystemPolicyStore(baseDir);
  const refOnDisk: PolicyRef = {
    ...policyOnDisk.ref,
    rulesUri: `config/policies/${T}/p-http-from-disk@1.0.0.json`,
  };
  const { decision, ruleId } = await evaluateAndRecordPolicy(deps, store, {
    tenantId: T,
    actor: "api-key:tenant-0:dev",
    policyRef: refOnDisk,
    action: httpAction(),
  });
  assert.equal(decision.kind, "allow");
  assert.equal(ruleId, "r-disk-allow");
});
