// Opportunity Discovery use cases — encodes Spec 003 acceptance criteria.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDeps } from "./helpers.ts";
import { createLeadUseCase, qualifyLeadUseCase, projectLead } from "@daedalus/core";
import { startDraftUseCase, finalizeDraftUseCase } from "@daedalus/proposal-generation";
import {
  surfaceOpportunityUseCase,
  enrichOpportunityUseCase,
  qualifyOpportunityUseCase,
  dismissOpportunityUseCase,
  projectPipeline,
} from "@daedalus/opportunity-discovery";

const T = "tenant-0";

test("AC-1: surface emits OpportunitySurfaced and opportunity appears in pipeline", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "ACME consulting",
    source: "referral",
  });
  assert.ok(opportunityId);

  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "OpportunitySurfaced").length, 1);
  const surfaced = events.find((e) => e.type === "OpportunitySurfaced")!;
  assert.equal(surfaced.payload.label, "ACME consulting");
  assert.equal(surfaced.payload.source, "referral");

  const pipeline = projectPipeline(events);
  assert.equal(pipeline.surfaced.length, 1);
  assert.equal(pipeline.surfaced[0].label, "ACME consulting");
});

test("AC-2: enrich emits OpportunityEnriched; closed state rejected", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Beta Corp",
    source: "cold",
  });
  await enrichOpportunityUseCase(deps, {
    tenantId: T,
    opportunityId,
    description: "Infrastructure review",
    contact: "cxo@beta.com",
  });

  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "OpportunityEnriched").length, 1);
  const enriched = events.find((e) => e.type === "OpportunityEnriched")!;
  assert.equal(enriched.payload.description, "Infrastructure review");
  assert.equal(enriched.payload.contact, "cxo@beta.com");

  // Enrichment updates the work-area.
  const opp = await deps.opportunityStore.load(T, opportunityId);
  assert.ok(opp);
  assert.equal(opp.description, "Infrastructure review");
  assert.equal(opp.contact, "cxo@beta.com");

  // Enrichment on a qualified opportunity is rejected.
  await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId });
  await assert.rejects(
    () => enrichOpportunityUseCase(deps, { tenantId: T, opportunityId, description: "nope" }),
    /qualified/,
  );
});

test("AC-3: qualify emits OpportunityQualified + LeadCreated + LeadQualified with shared lineage", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Gamma Labs",
    source: "conference",
  });

  const { leadId } = await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId });
  assert.ok(leadId);

  const events = await deps.eventStore.readStream(T);
  const qualified = events.find((e) => e.type === "OpportunityQualified")!;
  const leadCreated = events.find((e) => e.type === "LeadCreated")!;
  const leadQualified = events.find((e) => e.type === "LeadQualified")!;

  // Module milestone emitted.
  assert.ok(qualified);

  // Core handoff: LeadCreated carries opportunityId for lineage.
  assert.equal(leadCreated.payload.opportunityId, opportunityId);
  assert.equal(leadCreated.payload.customer, "Gamma Labs");
  assert.equal(leadCreated.payload.leadId, leadId);

  // All three share a correlationId.
  assert.equal(qualified.correlationId, leadCreated.correlationId);
  assert.equal(leadCreated.correlationId, leadQualified.correlationId);

  // LeadQualified is caused by LeadCreated.
  assert.equal(leadQualified.causationId, leadCreated.eventId);

  // Re-qualifying is rejected (idempotent handoff).
  await assert.rejects(
    () => qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId }),
    /already qualified/,
  );
});

test("AC-4: dismiss emits OpportunityDismissed with reason; closed state rejected", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Delta Inc",
    source: "cold",
  });

  await dismissOpportunityUseCase(deps, { tenantId: T, opportunityId, reason: "bad fit" });

  const events = await deps.eventStore.readStream(T);
  const dismissed = events.find((e) => e.type === "OpportunityDismissed")!;
  assert.equal(dismissed.payload.reason, "bad fit");

  // No Lead created on dismissal.
  assert.equal(events.filter((e) => e.type === "LeadCreated").length, 0);

  // Dismissal of already dismissed is rejected.
  await assert.rejects(
    () => dismissOpportunityUseCase(deps, { tenantId: T, opportunityId, reason: "no" }),
    /already dismissed/,
  );

  // Dismissal of qualified is rejected.
  const { opportunityId: opp2 } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Epsilon",
    source: "referral",
  });
  await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId: opp2 });
  await assert.rejects(
    () => dismissOpportunityUseCase(deps, { tenantId: T, opportunityId: opp2, reason: "no" }),
    /qualified/,
  );
});

test("AC-5: pipeline projection groups by state; no event on read", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId: o1 } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Alpha",
    source: "referral",
  });
  await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId: o1 });

  const { opportunityId: o2 } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Beta",
    source: "cold",
  });
  await dismissOpportunityUseCase(deps, { tenantId: T, opportunityId: o2, reason: "bad fit" });

  await surfaceOpportunityUseCase(deps, { tenantId: T, label: "Gamma", source: "conference" });

  const eventsBefore = (await deps.eventStore.readStream(T)).length;
  const pipeline = projectPipeline(await deps.eventStore.readStream(T));
  const eventsAfter = (await deps.eventStore.readStream(T)).length;

  // Reading the pipeline emits no events.
  assert.equal(eventsAfter, eventsBefore);

  assert.equal(pipeline.qualified.length, 1);
  assert.equal(pipeline.dismissed.length, 1);
  assert.equal(pipeline.surfaced.length, 1);
  assert.equal(pipeline.qualified[0].label, "Alpha");
  assert.equal(pipeline.dismissed[0].reason, "bad fit");
  assert.equal(pipeline.surfaced[0].label, "Gamma");
});

test("AC-6: state is reconstructable from the event stream", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Reconstruct",
    source: "test",
  });
  await enrichOpportunityUseCase(deps, {
    tenantId: T,
    opportunityId,
    description: "enriched",
    contact: "test@test.com",
  });
  const { leadId } = await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId });

  // The pipeline projection reconstructs the full state from events alone.
  const pipeline = projectPipeline(await deps.eventStore.readStream(T));
  assert.equal(pipeline.qualified.length, 1);
  assert.equal(pipeline.qualified[0].leadId, leadId);
});

test("AC-7: every event carries lineage (tenant, actor, correlationId)", async () => {
  const { deps } = makeTestDeps();
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "Lineage",
    source: "test",
  });
  await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId });

  const events = await deps.eventStore.readStream(T);
  for (const e of events) {
    assert.equal(typeof e.eventId, "string");
    assert.equal(e.tenantId, T);
    assert.equal(typeof e.actor, "string");
    assert.equal(typeof e.correlationId, "string");
    assert.ok("causationId" in e);
  }
});

test("AC-8: estimates are tenant-isolated", async () => {
  const { deps } = makeTestDeps();

  // Tenant-0 has opportunities.
  await surfaceOpportunityUseCase(deps, { tenantId: T, label: "Tenant0", source: "test" });

  // Tenant-other should see nothing.
  const otherPipeline = projectPipeline(await deps.eventStore.readStream("tenant-other"));
  assert.equal(otherPipeline.surfaced.length, 0);
  assert.equal(otherPipeline.qualified.length, 0);
  assert.equal(otherPipeline.dismissed.length, 0);
});

test("cross-module: qualified opportunity feeds proposal generation end-to-end", async () => {
  const { deps } = makeTestDeps();

  // Surface an opportunity, qualify it (produces a Lead).
  const { opportunityId } = await surfaceOpportunityUseCase(deps, {
    tenantId: T,
    label: "EndToEnd Corp",
    source: "referral",
  });
  const { leadId } = await qualifyOpportunityUseCase(deps, { tenantId: T, opportunityId });

  // The lead from Opportunity Discovery can be used to start a proposal.
  const { draftId } = await startDraftUseCase(deps, {
    tenantId: T,
    leadId,
    template: "standard",
  });
  const result = await finalizeDraftUseCase(deps, { tenantId: T, draftId, currency: "CLP" });
  assert.equal(result.expectedValue.amount, 0); // no line items
  assert.equal(result.expectedValue.currency, "CLP");

  // The event stream shows the full cross-module chain.
  const events = await deps.eventStore.readStream(T);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("OpportunitySurfaced"));
  assert.ok(types.includes("OpportunityQualified"));
  assert.ok(types.includes("LeadCreated"));
  assert.ok(types.includes("LeadQualified"));
  assert.ok(types.includes("ProposalDraftCreated"));
  assert.ok(types.includes("ProposalDraftFinalized"));
  assert.ok(types.includes("ProposalGenerated"));
});

test("lead:discard transitions Lead to discarded state", async () => {
  const { deps } = makeTestDeps();
  const { leadId } = await createLeadUseCase(deps, { tenantId: T, customer: "DiscardTest" });
  const { discardLeadUseCase } = await import("@daedalus/core");
  await discardLeadUseCase(deps, { tenantId: T, leadId, reason: "not a fit" });
  const lead = projectLead(await deps.eventStore.readStream(T), leadId);
  assert.equal(lead?.state, "discarded");
});