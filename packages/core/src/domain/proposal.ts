// Core aggregate: Proposal. State machine:
//   generated -> submitted -> (approved | rejected).
//   approved and rejected are terminal.
// Per Spec 006 §5.

import type { EventIntent } from "./event.ts";
import {
  ProposalGenerated,
  ProposalSubmitted,
  ProposalApproved,
  ProposalRejected,
} from "./value-chain.ts";

export type ProposalState = "generated" | "submitted" | "approved" | "rejected";

export type Proposal = {
  id: string;
  tenantId: string;
  leadId: string;
  draftId: string;
  expectedValue: { amount: number; currency: string };
  state: ProposalState;
  rejectionReason: string | null;
};

export function createProposal(input: {
  id: string;
  tenantId: string;
  leadId: string;
  draftId: string;
  expectedValue: { amount: number; currency: string };
}): { proposal: Proposal; events: EventIntent[] } {
  if (!Number.isFinite(input.expectedValue.amount) || input.expectedValue.amount < 0) {
    throw new Error("Proposal expectedValue amount must be a non-negative finite number");
  }
  if (input.expectedValue.currency.trim().length === 0) {
    throw new Error("Proposal expectedValue currency is required");
  }
  const proposal: Proposal = {
    id: input.id,
    tenantId: input.tenantId,
    leadId: input.leadId,
    draftId: input.draftId,
    expectedValue: input.expectedValue,
    state: "generated",
    rejectionReason: null,
  };
  return {
    proposal,
    events: [
      {
        type: ProposalGenerated,
        payload: {
          proposalId: input.id,
          leadId: input.leadId,
          draftId: input.draftId,
          expectedValue: input.expectedValue,
        },
      },
    ],
  };
}

export function submitProposal(proposal: Proposal): { proposal: Proposal; events: EventIntent[] } {
  if (proposal.state === "submitted") return { proposal, events: [] };
  if (proposal.state === "approved" || proposal.state === "rejected") {
    throw new Error(`Proposal ${proposal.id} is ${proposal.state}; it cannot be submitted`);
  }
  return {
    proposal: { ...proposal, state: "submitted" },
    events: [{ type: ProposalSubmitted, payload: { proposalId: proposal.id } }],
  };
}

export function approveProposal(proposal: Proposal): { proposal: Proposal; events: EventIntent[] } {
  if (proposal.state === "approved") return { proposal, events: [] };
  if (proposal.state === "rejected") {
    throw new Error(`Proposal ${proposal.id} is rejected and cannot be approved`);
  }
  if (proposal.state !== "submitted" && proposal.state !== "generated") {
    throw new Error(`Proposal ${proposal.id} is in state ${proposal.state}; cannot approve`);
  }
  return {
    proposal: { ...proposal, state: "approved" },
    events: [{ type: ProposalApproved, payload: { proposalId: proposal.id, leadId: proposal.leadId, expectedValue: proposal.expectedValue } }],
  };
}

export function rejectProposal(
  proposal: Proposal,
  reason: string,
): { proposal: Proposal; events: EventIntent[] } {
  if (proposal.state === "rejected") return { proposal, events: [] };
  if (proposal.state === "approved") {
    throw new Error(`Proposal ${proposal.id} is already approved and cannot be rejected`);
  }
  if (reason.trim().length === 0) {
    throw new Error("Rejecting a proposal requires a reason");
  }
  return {
    proposal: { ...proposal, state: "rejected", rejectionReason: reason },
    events: [{ type: ProposalRejected, payload: { proposalId: proposal.id, reason } }],
  };
}