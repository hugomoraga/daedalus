// AC-6/v1: alerts — low_runway, revenue_concentration, negative_cashflow,
// emit-once-until-clear semantics.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "../helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase, approveProposalUseCase } from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import {
  ingestProposalRevenueUseCase,
  registerExpenseUseCase,
  evaluateAlertsUseCase,
  receiveRevenueUseCase,
  confirmRevenueUseCase,
  createEstimateUseCase,
  projectConcentrationRatio,
  projectNegativeCashflowRatio,
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

test("AC-6/v1: low_runway alert raised when runway below threshold", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 5000, currency: "CLP" });
  const out = await evaluateAlertsUseCase(deps, { tenantId: T });
  const lowRunway = out.raised.find((r) => r.ruleId === "low_runway");
  assert.ok(lowRunway);
  assert.equal(lowRunway.triggered, true);
});

test("AC-6/v1: low_runway emits once per condition until cleared (no spam)", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 5000, currency: "CLP" });
  const first = await evaluateAlertsUseCase(deps, { tenantId: T });
  const second = await evaluateAlertsUseCase(deps, { tenantId: T });
  const firstLow = first.raised.find((r) => r.ruleId === "low_runway");
  assert.ok(firstLow);
  const secondLow = second.raised.find((r) => r.ruleId === "low_runway");
  assert.equal(secondLow, undefined);

  const events = await deps.eventStore.readStream(T);
  const flagged = events.filter((e) => e.type === "FinancialRiskFlagged");
  const lowRunwayFlags = flagged.filter(
    (e) => (e.payload as { ruleId?: string }).ruleId === "low_runway",
  );
  assert.equal(lowRunwayFlags.length, 1);
});

test("AC-6/v1: revenue_concentration alert when a single source exceeds the threshold", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  const proposal = (await deps.eventStore.readStream(T)).find(
    (e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId,
  );
  const expectedValue = proposal!.payload.expectedValue as { amount: number; currency: string };
  const leadId = String(proposal!.payload.leadId);
  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  await approveProposalUseCase(deps, { tenantId: T, proposalId, leadId, expectedValue });
  await receiveRevenueUseCase(deps, {
    tenantId: T,
    estimateId: (await deps.eventStore.readStream(T)).find((e) => e.type === "RevenueEstimateCreated")!.payload.estimateId as string,
  });

  const conc = projectConcentrationRatio(await deps.eventStore.readStream(T));
  assert.ok(conc > 0.6);
  const out = await evaluateAlertsUseCase(deps, { tenantId: T });
  const concentration = out.raised.find((r) => r.ruleId === "revenue_concentration");
  assert.ok(concentration);
});

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