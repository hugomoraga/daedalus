// Friction test: try to break the system via bad inputs.
// What we want to see: graceful, deterministic errors. Not crashes. Not silent corruption.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "./helpers.ts";
import {
  startDraftUseCase,
  addLineItemUseCase,
  finalizeDraftUseCase,
  discardDraftUseCase,
} from "@daedalus/proposal-generation";
import {
  createLeadUseCase,
  qualifyLeadUseCase,
  discardLeadUseCase,
} from "@daedalus/core";
import { ingestProposalRevenueUseCase } from "@daedalus/revenue-visibility";
import {
  surfaceOpportunityUseCase,
  enrichOpportunityUseCase,
  qualifyOpportunityUseCase,
  dismissOpportunityUseCase,
} from "@daedalus/opportunity-discovery";

const T = "tenant-0";

test("friction/empty-string customer rejected at lead:create", async () => {
  const { deps } = makeTestDeps();
  await assert.rejects(
    () => createLeadUseCase(deps, { tenantId: T, customer: "" }),
    /customer/i,
  );
});

test("friction/empty-string opportunity label rejected", async () => {
  const { deps } = makeTestDeps();
  await assert.rejects(
    () => surfaceOpportunityUseCase(deps, { tenantId: T, label: "", source: "x" }),
    /label/i,
  );
});

test("friction/negative amount on add-line-item", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "X" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId });
  // -100 amount
  await assert.rejects(
    () => addLineItemUseCase(deps, { tenantId: T, draftId, label: "X", amount: -100 }),
    /amount/i,
  );
});

test("friction/NaN amount rejected", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "X" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId });
  await assert.rejects(
    () => addLineItemUseCase(deps, { tenantId: T, draftId, label: "X", amount: Number.NaN }),
    /amount/i,
  );
});

test("friction/finalize a draft that doesn't exist", async () => {
  const { deps } = makeTestDeps();
  await assert.rejects(
    () => finalizeDraftUseCase(deps, { tenantId: T, draftId: "ghost", currency: "CLP" }),
    /not found/i,
  );
});

test("friction/qualify a lead that doesn't exist", async () => {
  const { deps } = makeTestDeps();
  await assert.rejects(
    () => qualifyLeadUseCase(deps, { tenantId: T, leadId: "ghost" }),
    /not found/i,
  );
});

test("friction/double-finalize the same draft", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "X" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "X", amount: 100 });
  await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
  await assert.rejects(
    () => finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" }),
    /state|finalized|not draft/i,
  );
});

test("friction/add-line-item to a finalized draft", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "X" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "X", amount: 100 });
  await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
  await assert.rejects(
    () => addLineItemUseCase(deps, { tenantId: T, draftId, label: "Y", amount: 200 }),
    /state|finalized|not draft/i,
  );
});

test("friction/discardLead with no reason", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "X" });
  await assert.rejects(
    () => discardLeadUseCase(deps, { tenantId: T, leadId, reason: "" }),
    /reason/i,
  );
});

test("friction/dismissOpportunity with no reason", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, { tenantId: T, label: "X", source: "y" });
  await assert.rejects(
    () => dismissOpportunityUseCase(deps, { tenantId: T, opportunityId, reason: "" }),
    /reason/i,
  );
});

test("friction/qualify an already-dismissed opportunity", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, { tenantId: T, label: "X", source: "y" });
  await dismissOpportunityUseCase(deps, { tenantId: T, opportunityId, reason: "cold" });
  await assert.rejects(
    () => qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId }),
    /state|dismissed/i,
  );
});

test("friction/qualify an opportunity from a different tenant id (path injection)", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, { tenantId: T, label: "X", source: "y" });
  // Try to qualify the same opportunity under a different tenant
  await assert.rejects(
    () => qualifyOpportunityUseCase(deps, { tenantId: "tenant-other", opportunityId }),
    /not found|state/i,
  );
});

test("friction/revenue:ingest with no proposals at all is a no-op, not an error", async () => {
  const { deps } = makeTestDeps();
  const out = await ingestProposalRevenueUseCase(deps, { tenantId: T });
  assert.deepEqual(out, { ingested: 0, confirmed: 0, received: 0 });
});
