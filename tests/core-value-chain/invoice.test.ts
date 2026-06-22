// AC-4 + AC-5: invoice reactor from ProjectDelivered, send, overdue, pay.
// AC-8: invoice rejects on undelivered project.

import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeAProposal, makeTestDeps } from "../helpers.ts";
import {
  approveProposalUseCase,
  createProjectUseCase,
  markProjectDeliveredUseCase,
  issueInvoiceUseCase,
  sendInvoiceUseCase,
  payInvoiceUseCase,
  markInvoiceOverdueUseCase,
  recordPaymentReceivedUseCase,
  projectInvoice,
} from "@daedalus/core";

const T = "tenant-0";

test("AC-4: issueInvoiceUseCase reacts to ProjectDelivered and emits InvoiceIssued", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
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
  const proposalId = await finalizeAProposal(deps, T);
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
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await assert.rejects(
    () => issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! }),
    /not been delivered/,
  );
});

test("AC-5: sendInvoiceUseCase transitions invoice to sent", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  const out = await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  assert.equal(out.changed, true);
});

test("AC-5: markInvoiceOverdueUseCase sets overdue flag without changing state", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await sendInvoiceUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  await markInvoiceOverdueUseCase(deps, { tenantId: T, invoiceId: invoiceId! });
  const inv = projectInvoice(await deps.eventStore.readStream(T), invoiceId!);
  assert.equal(inv?.state, "sent");
  assert.equal(inv?.isOverdue, true);
});

test("AC-5: payInvoiceUseCase transitions invoice to paid", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
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
  const proposalId = await finalizeAProposal(deps, T);
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
  const proposalId = await finalizeAProposal(deps, T);
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