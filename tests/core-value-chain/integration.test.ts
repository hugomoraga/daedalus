// AC-6 + AC-7 + AC-9: cross-cutting auditability, tenant isolation, end-to-end trail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeAProposal, makeTestDeps } from "../helpers.ts";
import {
  submitProposalUseCase,
  approveProposalUseCase,
  createProjectUseCase,
  markProjectDeliveredUseCase,
  issueInvoiceUseCase,
  sendInvoiceUseCase,
  payInvoiceUseCase,
  closeProjectUseCase,
  recordPaymentReceivedUseCase,
  projectProposal,
  projectProject,
  projectInvoice,
} from "@daedalus/core";

const T = "tenant-0";

test("AC-6: state is fully reconstructable from the event stream", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
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

test("AC-7: events are tenant-isolated (no cross-tenant leakage)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  const events = await deps.eventStore.readStream("tenant-other");
  assert.equal(events.length, 0);
  const p = projectProposal(events, proposalId);
  assert.equal(p, null);
});

test("AC-9: end-to-end Lead → Payment value chain", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
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
  for (const t of [
    "LeadCreated", "LeadQualified", "ProposalGenerated", "ProposalSubmitted", "ProposalApproved",
    "ProjectCreated", "ProjectDelivered", "InvoiceIssued", "InvoiceSent",
    "PaymentReceived", "InvoicePaid", "ProjectClosed",
  ]) {
    assert.ok(types.includes(t), `expected event ${t} in trail`);
  }
});