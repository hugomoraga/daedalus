// Revenue Visibility — the Estimate aggregate.
// Lifecycle: expected -> confirmed -> received. Confirmed and received are terminal-up
// (you can update details, but state only moves forward).
// Per Spec 001 §5, an estimate has: id, label, amount, currency, state, optional link
// to a Core source (proposalId, paymentId, leadId), optional notes.

import type { EventIntent } from "@daedalus/core";
import type { RevenueState } from "./revenue.ts";
import {
  RevenueEstimateCreated,
  RevenueEstimateUpdated,
  RevenueConfirmed,
  RevenueReceived,
} from "./events.ts";

export type Estimate = {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: string;
  state: RevenueState;
  sourceProposalId: string | null;
  notes: string;
};

export function createEstimate(input: {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: string;
  sourceProposalId?: string;
  notes?: string;
}): { estimate: Estimate; events: EventIntent[] } {
  validateLabel(input.label);
  validateAmount(input.amount);
  if (input.currency.trim().length === 0) {
    throw new Error("Estimate requires a currency");
  }
  const estimate: Estimate = {
    id: input.id,
    tenantId: input.tenantId,
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    state: "expected",
    sourceProposalId: input.sourceProposalId ?? null,
    notes: input.notes ?? "",
  };
  const payload: Record<string, unknown> = {
    estimateId: estimate.id,
    label: estimate.label,
    amount: estimate.amount,
    currency: estimate.currency,
    state: estimate.state,
    sourceProposalId: estimate.sourceProposalId,
  };
  if (estimate.notes.length > 0) payload.notes = estimate.notes;
  return {
    estimate,
    events: [{ type: RevenueEstimateCreated, payload }],
  };
}

// Derive a "v0-style" estimate from a Proposal's expectedValue, replicating the v0 payload
// shape so the existing tests + downstream consumers (RevenueSummary) keep working.
export function createEstimateFromProposal(input: {
  id: string;
  tenantId: string;
  sourceProposalId: string;
  amount: number;
  currency: string;
}): { estimate: Estimate; events: EventIntent[] } {
  validateAmount(input.amount);
  const estimate: Estimate = {
    id: input.id,
    tenantId: input.tenantId,
    label: `Proposal ${input.sourceProposalId.slice(0, 8)}`,
    amount: input.amount,
    currency: input.currency,
    state: "expected",
    sourceProposalId: input.sourceProposalId,
    notes: "",
  };
  return {
    estimate,
    events: [
      {
        type: RevenueEstimateCreated,
        payload: {
          estimateId: estimate.id,
          sourceProposalId: estimate.sourceProposalId,
          amount: estimate.amount,
          currency: estimate.currency,
          state: "expected",
        },
      },
    ],
  };
}

export function updateEstimate(
  estimate: Estimate,
  updates: { amount?: number; notes?: string; label?: string },
): { estimate: Estimate; events: EventIntent[] } {
  // Update is allowed in any state — state only moves forward; details can be corrected.
  if (updates.amount !== undefined) validateAmount(updates.amount);
  if (updates.label !== undefined) validateLabel(updates.label);
  const updated: Estimate = {
    ...estimate,
    amount: updates.amount ?? estimate.amount,
    notes: updates.notes ?? estimate.notes,
    label: updates.label ?? estimate.label,
  };
  return {
    estimate: updated,
    events: [
      {
        type: RevenueEstimateUpdated,
        payload: {
          estimateId: estimate.id,
          amount: updated.amount,
          notes: updated.notes,
          state: updated.state,
        },
      },
    ],
  };
}

export function confirmEstimate(
  estimate: Estimate,
): { estimate: Estimate; events: EventIntent[] } {
  if (estimate.state === "confirmed" || estimate.state === "received") {
    // Idempotent: skip if already past expected.
    return { estimate, events: [] };
  }
  const updated: Estimate = { ...estimate, state: "confirmed" };
  return {
    estimate: updated,
    events: [
      {
        type: RevenueConfirmed,
        payload: {
          estimateId: estimate.id,
          sourceProposalId: estimate.sourceProposalId,
          amount: updated.amount,
          currency: updated.currency,
          state: "confirmed",
        },
      },
    ],
  };
}

export function receiveEstimate(
  estimate: Estimate,
): { estimate: Estimate; events: EventIntent[] } {
  if (estimate.state === "received") {
    return { estimate, events: [] };
  }
  const updated: Estimate = { ...estimate, state: "received" };
  return {
    estimate: updated,
    events: [
      {
        type: RevenueReceived,
        payload: {
          estimateId: estimate.id,
          sourceProposalId: estimate.sourceProposalId,
          amount: updated.amount,
          currency: updated.currency,
          state: "received",
        },
      },
    ],
  };
}

function validateLabel(label: string): void {
  if (label.trim().length === 0) throw new Error("Estimate requires a label");
}

function validateAmount(amount: number): void {
  if (!Number.isFinite(amount)) throw new Error("Estimate amount must be a finite number");
  if (amount < 0) throw new Error("Estimate amount must be non-negative");
}