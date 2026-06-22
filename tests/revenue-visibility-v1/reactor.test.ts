// AC-3/v1: revenue reactor — ingests proposals and tracks the
// expected -> confirmed -> received lifecycle, plus manual confirm/receive.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "../helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase, approveProposalUseCase, recordPaymentReceivedUseCase } from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import {
  ingestProposalRevenueUseCase,
  confirmRevenueUseCase,
  createEstimateUseCase,
  receiveRevenueUseCase,
  projectFinancialSummary,
} from "@daedalus/revenue-visibility";

const T = "tenant-0";

async function finalizeAProposal(deps: ReturnType<typeof makeTestDeps>["deps"], tenantId = T): Promise<string> {
  const { leadId } = await createLeadUseCase(deps, { tenantId, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId, leadId, template: "standard" });
  await addLineItemUseCase(deps, { tenantId, draftId, label: "Discovery", amount: 1200 });
  await addLineItemUseCase(deps, { tenantId, draftId, label: "Build", amount: 4800 });
  const { proposalId } = await finalizeDraftUseCase(deps, { tenantId, draftId, currency: "CLP" });
  return proposalId;
}

test("AC-3/v1: lifecycle transitions via reactor (ProposalApproved/PaymentReceived)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);

  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);

  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  const afterApprove = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(afterApprove.ingested, 0);
  assert.equal(afterApprove.confirmed, 1);

  await recordPaymentReceivedUseCase(deps, {
    tenantId: T,
    proposalId,
    paymentId: "pay-1",
    amount: expectedValue.amount,
    currency: expectedValue.currency,
  });
  const afterPayment = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(afterPayment.received, 1);

  const events = await deps.eventStore.readStream(T);
  const summary = projectFinancialSummary(events);
  assert.equal(summary.expected, 0);
  assert.equal(summary.confirmed, 0);
  assert.equal(summary.received, 6000);
});

test("AC-3/v1: re-running ingest does not double-count", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);

  const first = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  await recordPaymentReceivedUseCase(deps, {
    tenantId: T,
    proposalId,
    paymentId: "p1",
    amount: 6000,
    currency: "CLP",
  });
  const second = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(first.ingested, 1);
  assert.equal(second.ingested, 0);
  assert.equal(second.confirmed, 1);
  assert.equal(second.received, 1);

  const third = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(third.ingested, 0);
  assert.equal(third.confirmed, 0);
  assert.equal(third.received, 0);
});

test("AC-3/v1: manual confirm and receive are idempotent", async () => {
  const { deps } = makeTestDeps();
  await createEstimateUseCase(deps, { tenantId: T, label: "Manual", amount: 1000, currency: "CLP" });
  const events = await deps.eventStore.readStream(T);
  const estimateId = (events.find((e) => e.type === "RevenueEstimateCreated")!.payload as { estimateId: string }).estimateId;

  const c1 = await confirmRevenueUseCase(deps, { tenantId: T, estimateId });
  const c2 = await confirmRevenueUseCase(deps, { tenantId: T, estimateId });
  assert.equal(c1.changed, true);
  assert.equal(c2.changed, false);

  const r1 = await receiveRevenueUseCase(deps, { tenantId: T, estimateId });
  const r2 = await receiveRevenueUseCase(deps, { tenantId: T, estimateId });
  assert.equal(r1.changed, true);
  assert.equal(r2.changed, false);
});