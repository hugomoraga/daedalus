import { submitProposalUseCase, rejectProposalUseCase, approveProposalUseCase, projectProposal } from "@daedalus/core";
import type { CommandHandler } from "./types.ts";
import { requireOpt } from "./types.ts";

const proposalSubmit: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await submitProposalUseCase(deps, { tenantId, proposalId: requireOpt(values.proposal, "proposal") });
  console.log(out.changed ? `ProposalSubmitted  proposal=${values.proposal}` : `already submitted  proposal=${values.proposal}`);
};

const proposalReject: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await rejectProposalUseCase(deps, {
    tenantId,
    proposalId: requireOpt(values.proposal, "proposal"),
    reason: requireOpt(values.reason, "reason"),
  });
  console.log(out.changed ? `ProposalRejected  proposal=${values.proposal}` : `already rejected  proposal=${values.proposal}`);
};

const proposalApprove: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await approveProposalUseCase(deps, { tenantId, proposalId: requireOpt(values.proposal, "proposal") });
  console.log(out.changed ? `ProposalApproved  proposal=${values.proposal}` : `already approved  proposal=${values.proposal}`);
};

const proposalStatus: CommandHandler = async ({ tenantId, values, deps }) => {
  const events = await deps.eventStore.readStream(tenantId);
  const p = projectProposal(events, requireOpt(values.proposal, "proposal"));
  if (p === null) throw new Error(`Proposal ${values.proposal} not found`);
  console.log(JSON.stringify(p, null, 2));
};

export const handlers: Array<[string, CommandHandler]> = [
  ["proposal:submit", proposalSubmit],
  ["proposal:reject", proposalReject],
  ["proposal:approve", proposalApprove],
  ["proposal:status", proposalStatus],
];
