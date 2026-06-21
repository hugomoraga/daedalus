// AC-9 (Spec 008): policy seam.
// The no-op policy returns allow; a deny policy routes the transition to
// HumanApprovalRequired instead of firing it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps, type PolicyDecisionPort } from "./helpers.ts";
import {
  HumanApprovalRequired,
  WorkflowTransitionFired,
} from "@daedalus/workflow-engine";

const recordingPolicy = (): PolicyDecisionPort & { calls: number } => {
  const p: PolicyDecisionPort & { calls: number } = {
    calls: 0,
    decide: async () => {
      p.calls += 1;
      return { allow: true };
    },
  };
  return p;
};

const denyingPolicy = (reason: string): PolicyDecisionPort => ({
  decide: async () => ({ allow: false, reason }),
});

test("AC-9 (default): the no-op policy is called and allows every transition", async () => {
  const policy = recordingPolicy();
  const e = makeEngineDeps({ policy });
  await e.append({
    eventId: "seed-1",
    type: "LeadQualified",
    tenantId: e.tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: {},
  });
  await e.runFor(200);
  assert.ok(policy.calls >= 1, "policy.decide invoked at least once");
  const events = await e.readStream(e.tenantId);
  assert.ok(events.some((x) => x.type === WorkflowTransitionFired));
  assert.equal(events.some((x) => x.type === HumanApprovalRequired), false);
});

test("AC-9 (denial): a deny policy routes the transition to HumanApprovalRequired", async () => {
  const policy = denyingPolicy("blocked by policy");
  const e = makeEngineDeps({ policy });
  await e.append({
    eventId: "seed-1",
    type: "LeadQualified",
    tenantId: e.tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: {},
  });
  await e.runFor(200);
  const events = await e.readStream(e.tenantId);
  const req = events.find((x) => x.type === HumanApprovalRequired);
  assert.ok(req, "HumanApprovalRequired emitted on policy denial");
  assert.equal(req!.payload.deniedByPolicy, true);
  assert.equal(req!.payload.denialReason, "blocked by policy");
  // The transition did NOT fire.
  assert.equal(
    events.some((x) => x.type === WorkflowTransitionFired),
    false,
    "transition not fired when policy denied",
  );
});