// Revenue Visibility v0 — cross-module composition with Proposal Generation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "./helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase } from "@daedalus/core";
import { startDraftUseCase, addLineItemUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import { ingestProposalRevenueUseCase, projectExpectedRevenue } from "@daedalus/revenue-visibility";

const T = "tenant-0";

// Drives a proposal to ProposalGenerated and returns the deps + stream.
async function finalizeAProposal(deps: ReturnType<typeof makeTestDeps>["deps"]) {
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Discovery", amount: 1200 });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Build", amount: 4800 });
  await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
}

test("AC-RV-1: ingest derives one RevenueEstimateCreated from a ProposalGenerated", async () => {
  const { deps } = makeTestDeps();
  await finalizeAProposal(deps);
  const out = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(out.ingested, 1);

  const events = await deps.eventStore.readStream(T);
  const estimates = events.filter((e) => e.type === "RevenueEstimateCreated");
  assert.equal(estimates.length, 1);
  assert.equal(estimates[0].payload.amount, 6000);
  assert.equal(estimates[0].payload.currency, "CLP");
  assert.equal(estimates[0].payload.state, "expected");
  assert.ok(estimates[0].payload.sourceProposalId);
});

test("AC-RV-2: the estimate shares the proposal's correlationId and is caused by it (followFrom)", async () => {
  const { deps } = makeTestDeps();
  await finalizeAProposal(deps);
  await ingestProposalRevenueUseCase(deps, { tenantId: T });

  const events = await deps.eventStore.readStream(T);
  const generated = events.find((e) => e.type === "ProposalGenerated");
  const estimate = events.find((e) => e.type === "RevenueEstimateCreated");
  assert.ok(generated && estimate);
  assert.equal(estimate.correlationId, generated.correlationId); // same flow
  assert.equal(estimate.causationId, generated.eventId); // caused by the proposal event
  assert.equal(estimate.payload.sourceProposalId, generated.payload.proposalId);
});

test("AC-RV-3: ingest is idempotent (one estimate per proposal)", async () => {
  const { deps } = makeTestDeps();
  await finalizeAProposal(deps);
  const first = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  const second = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.equal(first.ingested, 1);
  assert.equal(second.ingested, 0); // nothing new
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "RevenueEstimateCreated").length, 1);
});

test("AC-RV-4: projection sums expected revenue, reconstructable by replay", async () => {
  const { deps } = makeTestDeps();
  await finalizeAProposal(deps);
  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  const summary = projectExpectedRevenue(await deps.eventStore.readStream(T));
  assert.deepEqual(summary, { currency: "CLP", expected: 6000, count: 1 });
});

test("AC-RV-5: estimates are tenant-isolated", async () => {
  const { deps } = makeTestDeps();
  await finalizeAProposal(deps);
  await ingestProposalRevenueUseCase(deps, { tenantId: T });
  // A different tenant has no estimates.
  const other = projectExpectedRevenue(await deps.eventStore.readStream("tenant-other"));
  assert.deepEqual(other, { currency: "", expected: 0, count: 0 });
});
