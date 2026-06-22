// AC-2 + AC-3: project reactor from ProposalApproved, deliver, close.
// AC-8: project rejects without approval; close rejects unpaid invoices.

import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeAProposal, makeTestDeps } from "../helpers.ts";
import {
  approveProposalUseCase,
  createProjectUseCase,
  markProjectDeliveredUseCase,
  closeProjectUseCase,
  issueInvoiceUseCase,
  projectProject,
} from "@daedalus/core";

const T = "tenant-0";

test("AC-2: createProjectUseCase reacts to ProposalApproved and emits ProjectCreated", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const out = await createProjectUseCase(deps, { tenantId: T, proposalId });
  assert.equal(out.created, true);
  assert.ok(out.projectId);

  const events = await deps.eventStore.readStream(T);
  const created = events.find((e) => e.type === "ProjectCreated")!;
  assert.equal(created.payload.proposalId, proposalId);
  assert.equal(created.payload.expectedValue.amount, 6000);
});

test("AC-2: createProjectUseCase is idempotent (no double ProjectCreated)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const first = await createProjectUseCase(deps, { tenantId: T, proposalId });
  const second = await createProjectUseCase(deps, { tenantId: T, proposalId });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProjectCreated").length, 1);
});

test("AC-8: createProjectUseCase rejects without ProposalApproved", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await assert.rejects(
    () => createProjectUseCase(deps, { tenantId: T, proposalId }),
    /has not been approved/,
  );
});

test("AC-3: markProjectDeliveredUseCase transitions project to delivered", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  const out = await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  assert.equal(out.changed, true);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProjectDelivered").length, 1);
});

test("AC-3: closeProjectUseCase rejects an undelivered project", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await assert.rejects(
    () => closeProjectUseCase(deps, { tenantId: T, projectId: projectId! }),
    /not been delivered/,
  );
});

test("AC-3 + AC-8: closeProjectUseCase rejects close with unpaid invoices unless reason given", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  const { projectId } = await createProjectUseCase(deps, { tenantId: T, proposalId });
  await markProjectDeliveredUseCase(deps, { tenantId: T, projectId: projectId! });
  const { invoiceId } = await issueInvoiceUseCase(deps, { tenantId: T, projectId: projectId! });
  await assert.rejects(
    () => closeProjectUseCase(deps, { tenantId: T, projectId: projectId! }),
    /unpaid invoices/,
  );
  const out = await closeProjectUseCase(deps, { tenantId: T, projectId: projectId!, reason: "client dispute" });
  assert.equal(out.changed, true);
  const project = projectProject(await deps.eventStore.readStream(T), projectId!);
  assert.equal(project?.state, "closed");
  assert.equal(project?.closedReason, "client dispute");
  void invoiceId;
});