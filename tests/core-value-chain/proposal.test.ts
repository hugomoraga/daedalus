// AC-1: proposal lifecycle (submit / reject / approve).

import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeAProposal, makeTestDeps } from "../helpers.ts";
import {
  submitProposalUseCase,
  rejectProposalUseCase,
  approveProposalUseCase,
} from "@daedalus/core";

const T = "tenant-0";

test("AC-1: submitProposalUseCase emits ProposalSubmitted", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  const out = await submitProposalUseCase(deps, { tenantId: T, proposalId });
  assert.equal(out.changed, true);
  const events = await deps.eventStore.readStream(T);
  assert.equal(events.filter((e) => e.type === "ProposalSubmitted").length, 1);
});

test("AC-1: submitProposal is idempotent on a second invocation", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  const first = await submitProposalUseCase(deps, { tenantId: T, proposalId });
  const second = await submitProposalUseCase(deps, { tenantId: T, proposalId });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
});

test("AC-1: rejectProposalUseCase emits ProposalRejected with reason; rejects empty reason", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await assert.rejects(
    () => rejectProposalUseCase(deps, { tenantId: T, proposalId, reason: "" }),
    /reason/i,
  );
  const out = await rejectProposalUseCase(deps, { tenantId: T, proposalId, reason: "out of scope" });
  assert.equal(out.changed, true);
  const events = await deps.eventStore.readStream(T);
  const rejected = events.find((e) => e.type === "ProposalRejected")!;
  assert.equal(rejected.payload.reason, "out of scope");
});

test("AC-1: approved proposal cannot be rejected (terminal)", async () => {
  const { deps } = makeTestDeps();
  const proposalId = await finalizeAProposal(deps, T);
  await approveProposalUseCase(deps, { tenantId: T, proposalId });
  await assert.rejects(
    () => rejectProposalUseCase(deps, { tenantId: T, proposalId, reason: "no" }),
    /approved/,
  );
});