// Core value-chain completion (Spec 006 v0) — tests for the 9 new events + 2 new aggregates.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "./helpers.ts";
import {
  createLeadUseCase,
  qualifyLeadUseCase,
  submitProposalUseCase,
  rejectProposalUseCase,
  approveProposalUseCase,
  createProjectUseCase,
  markProjectDeliveredUseCase,
  closeProjectUseCase,
  issueInvoiceUseCase,
  sendInvoiceUseCase,
  payInvoiceUseCase,
  markInvoiceOverdueUseCase,
  recordPaymentReceivedUseCase,
  projectProposal,
  projectProject,
  projectInvoice,
} from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";

const T = "tenant-0";

// Drives a proposal to ProposalGenerated and returns the deps + the proposalId.
async function finalizeAProposal(deps: ReturnType<typeof makeTestDeps>["deps"]) {
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Discovery", amount: 1200 });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Build", amount: 4800 });
  const { proposalId } = await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
  return proposalId;
}

// AC-1: Proposal lifecycle (submit / reject).
test("AC-1: submitProposalUseCase emits ProposalSubmitted", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  const out = await submitProposalUseCase(deps, { tenantId: T, proposalId });
  assert.equal(out.changed, true);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProposalSubmitted").length, 1);
});

test("AC-1: submitProposal is idempotent on a second invocation", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  const first = await submitProposalUseCase(deps, { tenantId: T, proposalId });
  const second = await submitProposalUseCase(deps, { tenantId: T, proposalId });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
});

test("AC-1: rejectProposalUseCase emits ProposalRejected with reason; rejects empty reason", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await assert.rejects(
    () => rejectProposalUseCase(deps, { tenantId: T, proposalId, reason: "" }),
    /reason/i,
  );
  const out = await rejectProposalUseCase(deps, { tenantId: T, proposalId, reason: "out of scope" });
  assert.equal(out.changed, true);
  const events = await deps.eventStore.readStream(T);
  const rejected = events.find((e) => e.type === "ProposalRejected")!;
  assert.equal(rejected.payload.reason, "out of scope");
});

test("AC-1: approved proposal cannot be rejected (terminal)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  await assert.rejects(
    () => rejectProposalUseCase(deps, { tenantId: T, proposalId, reason: "no" }),
    /approved/,
  );
});

// AC-2: Project reactor from ProposalApproved.
test("AC-2: createProjectUseCase reacts to ProposalApproved and emits ProjectCreated", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const out = await createProjectUseCase(deps, { tenantId: T, proposalId });
  assert.equal(out.created, true);
  assert.ok(out.projectId);

  const events = await deps.eventStore.readStream(T);
  const created = events.find((e) => e.type === "ProjectCreated")!;
  assert.equal(created.payload.proposalId, proposalId);
  assert.equal(created.payload.expectedValue.amount, 6000);
});

test("AC-2: createProjectUseCase is idempotent (no double ProjectCreated)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const first = await createProjectUseCase(deps, { tenantId: T, proposalId });
  const second = await createProjectUseCase(deps, { tenantId: T, proposalId });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProjectCreated").length, 1);
});

test("AC-8: createProjectUseCase rejects without ProposalApproved", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  // No approveProposalUseCase call.
  await assert.rejects(
    () => createProjectUseCase(deps, { tenantId: T, proposalId }),
    /has not been approved/,
  );
});

// AC-3: Project deliver/close.
test("AC-3: markProjectDeliveredUseCase transitions project to delivered", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  const out = await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  assert.equal(out.changed, true);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProjectDelivered").length, 1);
});

test("AC-3: closeProjectUseCase rejects an undelivered project", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await assert.rejects(
    () => closeProjectUseCase(deps, { tenantId: T, projectId: projectId! }),
    /not been delivered/,
  );
});

test("AC-3 + AC-8: closeProjectUseCase rejects close with unpaid invoices unless reason given", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  // Invoice is issued but not paid.
  await assert.rejects(
    () => closeProjectUseCase(deps, { tenantId: T, projectId: projectId! }),
    /unpaid invoices/,
  );
  // Override with reason.
  const out = await closeProjectUseCase(deps, { tenantId: T, projectId: projectId!, reason: "client dispute" });
  assert.equal(out.changed, true);
  // The closed reason is recorded.
  const project = projectProject(await deps.eventStore.readStream(T), projectId!);
  assert.equal(project?.state, "closed");
  assert.equal(project?.closedReason, "client dispute");
  void invoiceId;
});

// AC-4: Invoice reactor from ProjectDelivered.
test("AC-4: issueInvoiceUseCase reacts to ProjectDelivered and emits InvoiceIssued", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const out = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  assert.equal(out.created, true);
  assert.ok(out.invoiceId);

  const events = await deps.eventStore.readStream(T);
  const issued = events.find((e) => e.type === "InvoiceIssued")!;
  assert.equal(issued.payload.projectId, projectId);
  assert.equal(issued.payload.amount, 6000);
});

test("AC-4: issueInvoiceUseCase is idempotent on projectId", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const first = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  const second = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
});

test("AC-8: issueInvoiceUseCase rejects an undelivered project", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  // No deliver.
  await assert.rejects(
    () => issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! }),
    /not been delivered/,
  );
});

// AC-5: Invoice send / overdue / pay.
test("AC-5: sendInvoiceUseCase transitions invoice to sent", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  const out = await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  assert.equal(out.changed, true);
});

test("AC-5: markInvoiceOverdueUseCase sets overdue flag without changing state", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  await markInvoiceOverdueUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  const inv = projectInvoice(await deps.eventStore.readStream(T), invoiceId!);
  assert.equal(inv?.state, "sent"); // state unchanged
  assert.equal(inv?.isOverdue, true); // flag set
});

test("AC-5: payInvoiceUseCase transitions invoice to paid", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  await recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 6000, currency: "CLP" });
  const out = await payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p1" });
  assert.equal(out.changed, true);
  const inv = projectInvoice(await deps.eventStore.readStream(T), invoiceId!);
  assert.equal(inv?.state, "paid");
  assert.equal(inv?.paidByPaymentId, "p1");
});

test("AC-5: payInvoice is idempotent on (invoiceId, paymentId)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  const first = await payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p1" });
  const second = await payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p1" });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
});

test("AC-5: payInvoice rejects a different paymentId on an already-paid invoice", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  await payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p1" });
  await assert.rejects(
    () => payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p2" }),
    /already paid/,
  );
});

// AC-6: auditability + replay.
test("AC-6: state is fully reconstructable from the event stream", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  await recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 6000, currency: "CLP" });
  await payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p1" });
  await closeProjectUseCase(deps, { tenantId: T, projectId: projectId! });

  const events = await deps.eventStore.readStream(T);
  const p = projectProposal(events, proposalId);
  const proj = projectProject(events, projectId!);
  const inv = projectInvoice(events, invoiceId!);
  assert.equal(p?.state, "approved");
  assert.equal(proj?.state, "closed");
  assert.equal(inv?.state, "paid");
});

// AC-7: tenant isolation.
test("AC-7: events are tenant-isolated (no cross-tenant leakage)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  // tenant-other sees nothing.
  const events = await deps.eventStore.readStream("tenant-other");
  assert.equal(events.length, 0);
  // tenant-0's proposal is in the right tenant.
  const p = projectProposal(events, proposalId);
  assert.equal(p, null);
});

// AC-9: end-to-end Lead → Payment.
test("AC-9: end-to-end Lead → Payment value chain", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await submitProposalUseCase(deps, { tenantId: T, proposalId });
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  await recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 6000, currency: "CLP" });
  await payInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId!, paymentId: "p1" });
  await closeProjectUseCase(deps, { tenantId: T, projectId: projectId! });

  const events = await deps.eventStore.readStream(T);
  const types = events.map((e) => e.type);
  // Every value-chain event should be in the trail.
  for (const t of [
    "LeadCreated", "LeadQualified", "ProposalGenerated", "ProposalSubmitted", "ProposalApproved",
    "ProjectCreated", "ProjectDelivered", "InvoiceIssued", "InvoiceSent",
    "PaymentReceived", "InvoicePaid", "ProjectClosed",
  ]) {
    assert.ok(types.includes(t), `expected event ${t} in trail`);
  }
});