// Use case: create a Project from an approved Proposal. Reactor pattern:
// reacts to ProposalApproved (or invoked explicitly via CLI).
// Idempotent on proposalId: a second invocation for the same proposal is a no-op.
//
// Cross-aggregate invariant: the proposal must be in 'approved' state.

import { appendIntents, enrich, followFrom, ProposalApproved, startLineage } from "@daedalus/core";
import type { CoreDeps } from "./deps.ts";
import { createProject } from "../domain/project.ts";
import { projectProposal } from "./projections.ts";

export type CreateProjectCommand = {
  tenantId: string;
  proposalId: string;
};

export async function createProjectUseCase(
  deps: CoreDeps,
  cmd: CreateProjectCommand,
): Promise<{ created: boolean; projectId?: string }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);

  // Idempotency: skip if a Project already exists for this proposal.
  const already = events.some(
    (e) => e.type === "ProjectCreated" && e.payload.proposalId === cmd.proposalId,
  );
  if (already) return { created: false };

  // Find the source ProposalApproved event (for lineage + cross-aggregate invariant).
  const source = events.find(
    (e) => e.type === ProposalApproved && e.payload.proposalId === cmd.proposalId,
  );
  if (source === undefined) {
    throw new Error(
      `Proposal ${cmd.proposalId} has not been approved; cannot create Project (AC-8)`,
    );
  }
  const proposal = projectProposal(events, cmd.proposalId);
  if (proposal === null || proposal.state !== "approved") {
    throw new Error(`Proposal ${cmd.proposalId} is not in 'approved' state`);
  }

  const projectId = deps.newId();
  const { project, events: intents } = createProject({
    id: projectId,
    tenantId: cmd.tenantId,
    proposalId: cmd.proposalId,
    leadId: proposal.leadId,
    customer: "", // customer is recorded in the Lead; the proposal carries leadId only.
    expectedValue: proposal.expectedValue,
  });
  void project;

  const lineage = source !== undefined ? followFrom(source) : startLineage(deps.newId);
  for (const intent of intents) {
    await deps.eventStore.append(
      enrich(intent, {
        tenantId: cmd.tenantId,
        actor: deps.actor,
        newId: deps.newId,
        now: deps.now,
        lineage,
      }),
    );
  }
  return { created: true, projectId };
}