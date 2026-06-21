// T-27: end-to-end evidence run (Spec 008 Plan 008 §8).
// Walks a full Lead -> Payment synthetic flow through the engine, hits the
// human gate at paid -> closed, issues HumanApproved, and asserts the
// instance reaches the terminal state. This is the canonical evidence that
// the engine satisfies the success chain end to end.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngineDeps } from "./helpers.ts";
import {
  HumanApprovalRequired,
  HumanApproved,
  WorkflowInstanceCompleted,
  WorkflowInstanceStarted,
  WorkflowTransitionFired,
} from "@daedalus/workflow-engine";

test("evidence run: full lead-to-payment walk with human gate at paid -> closed", async () => {
  const e = makeEngineDeps();

  // Seed the canonical 10-event value-chain flow.
  const base = Date.now() - 60_000;
  const iso = (offsetSec: number): string => new Date(base + offsetSec * 1000).toISOString();
  const seed: ReadonlyArray<readonly [string, string, number, string | null, Record<string, unknown>]> = [
    ["evt-1", "LeadCreated", 0, null, { customer: "ACME (mock)", leadId: "lead-1" }],
    ["evt-2", "LeadQualified", 1, "evt-1", { leadId: "lead-1" }],
    [
      "evt-3",
      "ProposalGenerated",
      2,
      "evt-2",
      {
        proposalId: "prop-1",
        leadId: "lead-1",
        expectedValue: { amount: 6000, currency: "USD" },
      },
    ],
    ["evt-4", "ProposalSubmitted", 3, "evt-3", { proposalId: "prop-1" }],
    ["evt-5", "ProposalApproved", 4, "evt-4", { proposalId: "prop-1" }],
    [
      "evt-6",
      "ProjectCreated",
      5,
      "evt-5",
      {
        projectId: "proj-1",
        proposalId: "prop-1",
        leadId: "lead-1",
        customer: "ACME (mock)",
        expectedValue: { amount: 6000, currency: "USD" },
      },
    ],
    ["evt-7", "ProjectDelivered", 6, "evt-6", { projectId: "proj-1" }],
    [
      "evt-8",
      "InvoiceIssued",
      7,
      "evt-7",
      {
        invoiceId: "inv-1",
        projectId: "proj-1",
        proposalId: "prop-1",
        amount: 6000,
        currency: "USD",
      },
    ],
    ["evt-9", "InvoicePaid", 8, "evt-8", { invoiceId: "inv-1", paymentId: "pay-1" }],
    ["evt-10", "ProjectClosed", 9, "evt-9", { projectId: "proj-1", reason: "delivered and paid" }],
  ];
  for (const [id, type, offset, cause, payload] of seed) {
    await e.append({
      eventId: id,
      type,
      tenantId: e.tenantId,
      occurredAt: iso(offset),
      actor: "test",
      causationId: cause,
      correlationId: "flow-evidence",
      payload,
    });
  }

  await e.runFor(300);
  const after1 = await e.readStream(e.tenantId);
  assert.ok(after1.some((x) => x.type === WorkflowInstanceStarted), "WorkflowInstanceStarted emitted");
  const firedBeforeApproval = after1.filter(
    (x) => x.type === WorkflowTransitionFired && x.correlationId === "flow-evidence",
  ).length;
  assert.equal(firedBeforeApproval, 8, "8 transitions fired before the human gate");
  const gate = after1.find((x) => x.type === HumanApprovalRequired);
  assert.ok(gate, "HumanApprovalRequired emitted when ProjectClosed matched the gated transition");
  assert.equal(gate!.payload.transitionId, "paid-to-closed");

  // Issue HumanApproved and run again.
  await e.append({
    eventId: "human-evidence",
    type: HumanApproved,
    tenantId: e.tenantId,
    occurredAt: new Date().toISOString(),
    actor: "test",
    causationId: null,
    correlationId: "flow-evidence",
    payload: { workflowName: "lead-to-payment", instanceId: "flow-evidence" },
  });
  await e.runFor(200);
  const after2 = await e.readStream(e.tenantId);
  const completed = after2.find((x) => x.type === WorkflowInstanceCompleted);
  assert.ok(completed, "WorkflowInstanceCompleted emitted after HumanApproved");
  assert.equal(completed!.payload.finalState, "closed");

  // Final instance state matches the workflow's terminal.
  const instance = (await e.deps.instanceStore.findByCorrelationId(e.tenantId, "flow-evidence")).find(
    (i) => i.workflowName === "lead-to-payment",
  );
  assert.ok(instance);
  assert.equal(instance!.currentState, "closed");
  assert.equal(instance!.status, "completed");
});