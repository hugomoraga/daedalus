// AC-8/v1 + AC-9/v1: lineage, tenant isolation, update-estimate, core guards.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "../helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase, approveProposalUseCase, recordPaymentReceivedUseCase } from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import {
  ingestProposalRevenueUseCase,
  registerExpenseUseCase,
  evaluateAlertsUseCase,
  createEstimateUseCase,
  updateEstimateUseCase,
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

test("AC-8/v1: every event carries tenant, actor, correlationId, causationId", async () => {
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
  for (const e of events) {
    assert.equal(e.tenantId, T);
    assert.equal(typeof e.actor, "string");
    assert.equal(typeof e.correlationId, "string");
    assert.ok("causationId" in e);
  }
});

test("AC-9/v1: events are tenant-isolated", async () => {
  const { deps } = makeTestDeps();
  await registerExpenseUseCase(deps, { tenantId: T, label: "x", amount: 100, currency: "CLP" });
  const out = await evaluateAlertsUseCase(deps, { tenantId: "tenant-other" });
  assert.equal(out.raised.length, 0);
  assert.equal(out.cleared.length, 0);
});

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

test("core: approve-proposal is idempotent on a second invocation", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  const first = await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const second = await approveProposalUseCase(deps, { tenantId: T, proposalId });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProposalApproved").length, 1);
});

test("core: record-payment rejects duplicate (proposalId, paymentId)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 1000, currency: "CLP" });
  await assert.rejects(
    () => recordPaymentReceivedUseCase(deps, { tenantId: T, proposalId, paymentId: "p1", amount: 1000, currency: "CLP" }),
    /already recorded/,
  );
});