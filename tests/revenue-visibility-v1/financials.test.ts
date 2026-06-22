// AC-4/v1, AC-5/v1, AC-7/v1: expenses reduce margin, FinancialSummary breakdown, snapshot.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "../helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase, approveProposalUseCase } from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import {
  ingestProposalRevenueUseCase,
  registerExpenseUseCase,
  takeSnapshotUseCase,
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

test("AC-4/v1: registered expenses reduce margin", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "rent", amount: 1000, currency: "CLP" });
  await registerExpenseUseCase(deps, { tenantId: T, label: "software", amount: 200, currency: "CLP" });

  const events = await deps.eventStore.readStream(T);
  const summary = projectFinancialSummary(events);
  assert.equal(summary.expenses, 1200);
  assert.equal(summary.expenseCount, 2);
  assert.equal(summary.margin, -1200);
});

test("AC-5/v1: FinancialSummary shows full breakdown and is replay-derivable", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
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
  assert.equal(summary.expected, 0);
  assert.equal(summary.confirmed, 6000);
  assert.equal(summary.received, 0);
  assert.equal(summary.expenses, 1000);
  assert.equal(summary.margin, 0 - 1000);
  assert.ok(summary.runwayMonths >= 0);
  assert.ok(["healthy", "watch", "at-risk", "unknown"].includes(summary.basicState));
});

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