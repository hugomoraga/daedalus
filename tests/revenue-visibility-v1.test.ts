// Revenue Visibility v1 — full Spec 001 slice: lifecycle, expenses, summary, alerts, snapshots.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "./helpers.ts";
import {
  createLeadUseCase,
  qualifyLeadUseCase,
  approveProposalUseCase,
  recordPaymentReceivedUseCase,
} from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import {
  ingestProposalRevenueUseCase,
  createEstimateUseCase,
  updateEstimateUseCase,
  confirmRevenueUseCase,
  receiveRevenueUseCase,
  registerExpenseUseCase,
  takeSnapshotUseCase,
  evaluateAlertsUseCase,
  projectFinancialSummary,
  projectConcentrationRatio,
  projectNegativeCashflowRatio,
} from "@daedalus/revenue-visibility";

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

// AC-3: lifecycle expected -> confirmed -> received via the reactor (v1)
test("AC-3/v1: lifecycle transitions via reactor (ProposalApproved/PaymentReceived)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);

  await ingestProposalRevenueUseCase(deps, { tenantId: T }); // RevenueEstimateCreated(expected)
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);

  // Approve the proposal.
  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  // Re-ingest: should pick up the ProposalApproved and emit RevenueConfirmed.
  const afterApprove = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(afterApprove.ingested, 0); // no new estimate
  assert.equal(afterApprove.confirmed, 1);

  // Record a payment.
  await recordPaymentReceivedUseCase(deps, {
    tenantId: T,
    proposalId,
    paymentId: "pay-1",
    amount: expectedValue.amount,
    currency: expectedValue.currency,
  });
  const afterPayment = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(afterPayment.received, 1);

  // The FinancialSummary reflects received=6000.
  const events = await deps.eventStore.readStream(T);
  const summary = projectFinancialSummary(events);
  assert.equal(summary.expected, 0);
  assert.equal(summary.confirmed, 0);
  assert.equal(summary.received, 6000);
});

// AC-3: no double-counting (idempotent reactor)
test("AC-3/v1: re-running ingest does not double-count", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
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
  // After approve + payment, the second ingest should produce confirm + receive.
  const second = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(first.ingested, 1);
  assert.equal(second.ingested, 0);
  assert.equal(second.confirmed, 1);
  assert.equal(second.received, 1);

  // A third ingest should be a no-op.
  const third = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(third.ingested, 0);
  assert.equal(third.confirmed, 0);
  assert.equal(third.received, 0);
});

// AC-3: manual confirm/receive are idempotent.
test("AC-3/v1: manual confirm and receive are idempotent", async () => {
  const { deps } = makeTestDeps();
  await createEstimateUseCase(deps, { tenantId: T, label: "Manual", amount: 1000, currency: "CLP" });
  const events = await deps.eventStore.readStream(T);
  const estimateId = (events.find((e) => e.type === "RevenueEstimateCreated")!.payload as { estimateId: string }).estimateId;

  const c1 = await confirmRevenueUseCase(deps, { tenantId: T, estimateId });
  const c2 = await confirmRevenueUseCase(deps, { tenantId: T, estimateId });
  assert.equal(c1.changed, true);
  assert.equal(c2.changed, false); // already confirmed

  const r1 = await receiveRevenueUseCase(deps, { tenantId: T, estimateId });
  const r2 = await receiveRevenueUseCase(deps, { tenantId: T, estimateId });
  assert.equal(r1.changed, true);
  assert.equal(r2.changed, false); // already received
});

// AC-4: ExpenseRegistered reduces margin.
test("AC-4/v1: registered expenses reduce margin", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 1000, currency: "CLP" });
  await registerExpenseUseCase(deps, { tenantId: T, label: "software", amount: 200, currency: "CLP" });

  const events = await deps.eventStore.readStream(T);
  const summary = projectFinancialSummary(events);
  assert.equal(summary.expenses, 1200);
  assert.equal(summary.expenseCount, 2);
  assert.equal(summary.margin, -1200); // no revenue yet
});

// AC-5: FinancialSummary has expected/confirmed/received separated, margin, runway, basicState.
test("AC-5/v1: FinancialSummary shows full breakdown and is replay-derivable", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);

  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 1000, currency: "CLP" });

  const events = await deps.eventStore.readStream(T);
  const summary = projectFinancialSummary(events);
  assert.equal(summary.expected, 0); // confirmed, not expected
  assert.equal(summary.confirmed, 6000);
  assert.equal(summary.received, 0);
  assert.equal(summary.expenses, 1000);
  assert.equal(summary.margin, 0 - 1000);
  assert.ok(summary.runwayMonths >= 0);
  assert.ok(["healthy", "watch", "at-risk", "unknown"].includes(summary.basicState));
});

// AC-6: low_runway alert.
test("AC-6/v1: low_runway alert raised when runway below threshold", async () => {
  const { deps } = makeTestDeps();
  // No revenue, lots of expenses: runway = 0, alerts.
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 5000, currency: "CLP" });
  const out = await evaluateAlertsUseCase(deps, { tenantId: T });
  const lowRunway = out.raised.find((r) => r.ruleId === "low_runway");
  assert.ok(lowRunway);
  assert.equal(lowRunway.triggered, true);
});

// AC-6: emit-once-until-clear (no alert spam).
test("AC-6/v1: low_runway emits once per condition until cleared (no spam)", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 5000, currency: "CLP" });
  const first = await evaluateAlertsUseCase(deps, { tenantId: T });
  const second = await evaluateAlertsUseCase(deps, { tenantId: T });
  const firstLow = first.raised.find((r) => r.ruleId === "low_runway");
  assert.ok(firstLow); // raised the first time
  // Second call: low_runway is still triggered but the rule was already raised.
  const secondLow = second.raised.find((r) => r.ruleId === "low_runway");
  assert.equal(secondLow, undefined); // not re-emitted

  // Verify only one FinancialRiskFlagged event for low_runway in the stream.
  const events = await deps.eventStore.readStream(T);
  const flagged = events.filter((e) => e.type === "FinancialRiskFlagged");
  const lowRunwayFlags = flagged.filter(
    (e) => (e.payload as { ruleId?: string }).ruleId === "low_runway",
  );
  assert.equal(lowRunwayFlags.length, 1);
});

// AC-6: revenue_concentration alert — uses source-linked estimates (from proposals).
test("AC-6/v1: revenue_concentration alert when a single source exceeds the threshold", async () => {
  const { deps } = makeTestDeps();
  // Drive a real proposal so the estimate has a sourceProposalId.
  const proposalId = await finalizeAProposal(deps);
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);
  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  await receiveRevenueUseCase(deps, { tenantId: T, estimateId: (await deps.eventStore.readStream(T)).find((e) => e.type === "RevenueEstimateCreated")!.payload.estimateId as string });

  // One source, all revenue — concentration = 1.0 (above 0.6 threshold).
  const conc = projectConcentrationRatio(await deps.eventStore.readStream(T));
  assert.ok(conc > 0.6);
  const out = await evaluateAlertsUseCase(deps, { tenantId: T });
  const concentration = out.raised.find((r) => r.ruleId === "revenue_concentration");
  assert.ok(concentration);
});

// AC-6: negative_cashflow alert.
test("AC-6/v1: negative_cashflow alert when expenses > revenue", async () => {
  const { deps } = makeTestDeps();
  await createEstimateUseCase(deps, { tenantId: T, label: "Rev", amount: 100, currency: "CLP" });
  const events = await deps.eventStore.readStream(T);
  const est = (events.find((e) => e.type === "RevenueEstimateCreated")!.payload as { estimateId: string }).estimateId;
  await confirmRevenueUseCase(deps, { tenantId: T, estimateId: est });
  await receiveRevenueUseCase(deps, { tenantId: T, estimateId: est });
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 5000, currency: "CLP" });

  const ratio = projectNegativeCashflowRatio(await deps.eventStore.readStream(T));
  assert.ok(ratio > 1);
  const out = await evaluateAlertsUseCase(deps, { tenantId: T });
  const neg = out.raised.find((r) => r.ruleId === "negative_cashflow");
  assert.ok(neg);
});

// AC-7: snapshot carries the current summary.
test("AC-7/v1: snapshot captures current FinancialSummary in payload", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 1000, currency: "CLP" });
  await takeSnapshotUseCase(deps, { tenantId: T });

  const events = await deps.eventStore.readStream(T);
  const snap = events.find((e) => e.type === "RevenueSnapshotGenerated");
  assert.ok(snap);
  const summaryAt = (snap!.payload.summaryAtEventTime) as { expenses: number; margin: number };
  assert.equal(summaryAt.expenses, 1000);
  assert.equal(summaryAt.margin, -1000);
});

// AC-8: lineage.
test("AC-8/v1: every event carries tenant, actor, correlationId, causationId", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);

  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 1000, currency: "CLP" });

  const events = await deps.eventStore.readStream(T);
  for (const e of events) {
    assert.equal(e.tenantId, T);
    assert.equal(typeof e.actor, "string");
    assert.equal(typeof e.correlationId, "string");
    assert.ok("causationId" in e);
  }
});

// AC-9: tenant isolation.
test("AC-9/v1: events are tenant-isolated", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "x", amount: 100, currency: "CLP" });
  const out = await evaluateAlertsUseCase(deps, { tenantId: "tenant-other" });
  // No events for tenant-other, no alerts, no errors.
  assert.equal(out.raised.length, 0);
  assert.equal(out.cleared.length, 0);
});

// Update estimate.
test("v1: update-estimate emits RevenueEstimateUpdated", async () => {
  const { deps } = makeTestDeps();
  const { estimateId } = await createEstimateUseCase(deps, { tenantId: T, label: "X", amount: 100, currency: "CLP" });
  await updateEstimateUseCase(deps, { tenantId: T, estimateId, amount: 200, notes: "revised" });
  const events = await deps.eventStore.readStream(T);
  const updated = events.find((e) => e.type === "RevenueEstimateUpdated");
  assert.ok(updated);
  assert.equal((updated!.payload as { amount: number }).amount, 200);
  assert.equal((updated!.payload as { notes: string }).notes, "revised");
});

// Core: approve-proposal idempotency.
test("core: approve-proposal is idempotent on a second invocation", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  const first = await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const second = await approveProposalUseCase(deps, { tenantId: T, proposalId });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false); // no-op
  // Only one ProposalApproved event in the stream.
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProposalApproved").length, 1);
});

// Core: record-payment rejects duplicates.
test("core: record-payment rejects duplicate (proposalId, paymentId)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps);
  await recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 1000, currency: "CLP" });
  await assert.rejects(
    () => recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 1000, currency: "CLP" }),
    /already recorded/,
  );
});