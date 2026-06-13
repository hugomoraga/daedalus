// Proposal Generation use cases — encodes Spec 002 acceptance criteria.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "./helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase, projectLead } from "@daedalus/core";
import {
  startDraftUseCase,
  addLineItemUseCase,
  finalizeDraftUseCase,
  discardDraftUseCase,
} from "@daedalus/proposal-generation";

const T = "tenant-0";

test("AC-1: a draft cannot start from an unqualified lead", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await assert.rejects(
    () => startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" }),
    /not qualified/,
  );
});

test("AC-1: a draft starts from a qualified lead and emits ProposalDraftCreated", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProposalDraftCreated").length, 1);
  assert.ok(draftId);
});

test("AC-4: editing a draft emits no event", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  const before = (await deps.eventStore.readStream(T)).length;
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Discovery", amount: 1200 });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Build", amount: 4800 });
  const after = (await deps.eventStore.readStream(T)).length;
  assert.equal(after, before); // edits added zero events
});

test("AC-3 + AC-5 + R1: finalize emits exactly one ProposalGenerated with expectedValue = sum", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Discovery", amount: 1200 });
  await addLineItemUseCase(deps, { tenantId: T, draftId, label: "Build", amount: 4800 });

  const result = await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
  assert.deepEqual(result.expectedValue, { amount: 6000, currency: "CLP" });

  const events = await deps.eventStore.readStream(T);
  const generated = events.filter((e) => e.type === "ProposalGenerated");
  assert.equal(generated.length, 1); // exactly one, no duplication
  assert.deepEqual(generated[0].payload.expectedValue, { amount: 6000, currency: "CLP" });
  assert.equal(events.filter((e) => e.type === "ProposalDraftFinalized").length, 1);
});

test("AC-5: a finalized draft can no longer be edited", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
  await assert.rejects(
    () => addLineItemUseCase(deps, { tenantId: T, draftId, label: "Late", amount: 1 }),
    /finalized/,
  );
});

test("AC-6: discard emits ProposalDraftDiscarded and creates no Core Proposal", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  const { draftId } = await startDraftUseCase(deps, { tenantId: T, leadId, template: "standard" });
  await discardDraftUseCase(deps, { tenantId: T, draftId });
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProposalDraftDiscarded").length, 1);
  assert.equal(events.filter((e) => e.type === "ProposalGenerated").length, 0);
});

test("AC-7: lead state is reconstructable by replaying events", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "ACME (mock)" });
  assert.equal(projectLead(await deps.eventStore.readStream(T), leadId)?.state, "unqualified");
  await qualifyLeadUseCase(deps, { tenantId: T, leadId });
  assert.equal(projectLead(await deps.eventStore.readStream(T), leadId)?.state, "qualified");
});
