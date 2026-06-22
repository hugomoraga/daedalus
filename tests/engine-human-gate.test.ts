// AC-4 (Spec 008): human gate.
// Given a transition marked requiresHuman: true,
// When its trigger event arrives and the guard passes,
// Then the engine emits HumanApprovalRequired and does NOT invoke the action.
// When a HumanApproved event arrives for the same correlation,
// Then the engine invokes the action and emits WorkflowTransitionFired.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps } from "./helpers.ts";
import {
  HumanApprovalRequired,
  WorkflowInstanceCompleted,
  WorkflowTransitionFired,
} from "@daedalus/workflow-engine";

test("AC-4: human gate waits for HumanApproved before firing", async () => {
  const e = makeEngineDeps();
  // Drive the workflow all the way to "paid" by appending value-chain events.
  const base = "2026-06-21T00:00:00.000Z";
  const ts = (offsetSec: number): string => new Date(Date.parse(base) + offsetSec * 1000).toISOString();
  const seed = [
    ["lead-c", "LeadCreated", 0, null, { customer: "Acme", leadId: "lead-1" }],
    ["lead-q", "LeadQualified", 1, "lead-c", { leadId: "lead-1" }],
    ["prop-g", "ProposalGenerated", 2, "lead-q", { proposalId: "prop-1", leadId: "lead-1", expectedValue: { amount: 6000, currency: "USD" } }],
    ["prop-s", "ProposalSubmitted", 3, "prop-g", { proposalId: "prop-1" }],
    ["prop-a", "ProposalApproved", 4, "prop-s", { proposalId: "prop-1" }],
    ["proj-c", "ProjectCreated", 5, "prop-a", { projectId: "proj-1", proposalId: "prop-1", leadId: "lead-1", customer: "Acme", expectedValue: { amount: 6000, currency: "USD" } }],
    ["proj-d", "ProjectDelivered", 6, "proj-c", { projectId: "proj-1" }],
    ["inv-i", "InvoiceIssued", 7, "proj-d", { invoiceId: "inv-1", projectId: "proj-1", proposalId: "prop-1", amount: 6000, currency: "USD" }],
    ["inv-p", "InvoicePaid", 8, "inv-i", { invoiceId: "inv-1", paymentId: "pay-1" }],
    ["proj-cl", "ProjectClosed", 9, "inv-p", { projectId: "proj-1", reason: "delivered and paid" }],
  ] as const;
  for (const [id, type, offset, cause, payload] of seed) {
    await e.append({
      eventId: id,
      type,
      tenantId: e.tenantId,
      occurredAt: ts(offset),
      actor: "test",
      causationId: cause,
      correlationId: "flow-1",
      payload,
    });
  }
  await e.runFor(400);
  const after1 = await e.readStream(e.tenantId);
  const gate = after1.find((x) => x.type === HumanApprovalRequired);
  assert.ok(gate, "HumanApprovalRequired emitted when ProjectClosed arrived");
  assert.equal(gate!.payload.transitionId, "paid-to-closed");
  assert.equal(gate!.payload.target, "closed");
  // The transition must NOT have fired yet (no WorkflowTransitionFired for
  // paid-to-closed).
  const firedPaidToClosed = after1.find(
    (x) => x.type === WorkflowTransitionFired && x.payload.transitionId === "paid-to-closed",
  );
  assert.equal(firedPaidToClosed, undefined, "transition not yet fired");

  // Now issue HumanApproved and let the engine process it.
  await e.append({
    eventId: "human-1",
    type: "HumanApproved",
    tenantId: e.tenantId,
    occurredAt: new Date().toISOString(),
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: { workflowName: "lead-to-payment", instanceId: "flow-1" },
  });
  await e.runFor(350);
  const after2 = await e.readStream(e.tenantId);
  const fired = after2.find(
    (x) => x.type === WorkflowTransitionFired && x.payload.transitionId === "paid-to-closed",
  );
  assert.ok(fired, "paid -> closed transition fired after HumanApproved");
  assert.equal(fired!.payload.toState, "closed");
  assert.equal(fired!.causationId, "human-1", "lineage points at the human action");
  const completed = after2.find((x) => x.type === WorkflowInstanceCompleted);
  assert.ok(completed, "WorkflowInstanceCompleted emitted (closed is terminal)");
});