// Revenue Visibility v1 — reactor use case.
// Reacts to THREE Core events, each producing a derived module event:
//   - ProposalGenerated -> RevenueEstimateCreated (expected)
//   - ProposalApproved  -> RevenueConfirmed
//   - PaymentReceived   -> RevenueReceived
//
// Idempotency:
//   - One estimate per ProposalGenerated (skip if already exists).
//   - Confirm/Receive are no-ops if the estimate is already in that state or past it.
//
// Lineage:
//   - All derived events followFrom(sourceEvent), inheriting correlationId and
//     setting causationId to the source eventId. Same pattern as v0.

import { enrich, followFrom, ProposalGenerated, ProposalApproved, PaymentReceived } from "@daedalus/core";
import type { CoreDeps, DomainEvent } from "@daedalus/core";
import { RevenueEstimateCreated } from "../domain/events.ts";
import { createEstimateFromProposal, confirmEstimate, receiveEstimate } from "../domain/estimate.ts";
import { projectEstimate } from "./projections.ts";

export type IngestProposalRevenueCommand = {
  tenantId: string;
};

type ExpectedValue = { amount: number; currency: string };

export async function ingestProposalRevenueUseCase(
  deps: CoreDeps,
  cmd: IngestProposalRevenueCommand,
): Promise<{ ingested: number; confirmed: number; received: number }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);

  // Build the set of estimateIds and their current state by replaying estimates.
  // We use the same replay logic as projectEstimate per estimateId.
  const existingEstimates = new Set<string>();
  for (const e of events) {
    if (e.type === RevenueEstimateCreated) {
      const id = e.payload.estimateId as string | undefined;
      if (id !== undefined) existingEstimates.add(id);
    }
  }

  let ingested = 0;
  let confirmed = 0;
  let received = 0;

  // Pass 1: ProposalGenerated -> RevenueEstimateCreated(expected)
  for (const source of events) {
    if (source.type !== ProposalGenerated) continue;
    const proposalId = source.payload.proposalId as string | undefined;
    if (proposalId === undefined) continue;
    const alreadyHasEstimate = events.some(
      (e) => e.type === RevenueEstimateCreated && e.payload.sourceProposalId === proposalId,
    );
    if (alreadyHasEstimate) continue;

    const expectedValue = source.payload.expectedValue as ExpectedValue | undefined;
    if (expectedValue === undefined) continue;

    const id = deps.newId();
    const { events: intents } = createEstimateFromProposal({
      id,
      tenantId: cmd.tenantId,
      sourceProposalId: proposalId,
      amount: expectedValue.amount,
      currency: expectedValue.currency,
    });
    for (const intent of intents) {
      await deps.eventStore.append(
        enrich(intent, {
          tenantId: cmd.tenantId,
          actor: deps.actor,
          newId: deps.newId,
          now: deps.now,
          lineage: followFrom(source),
        }),
      );
    }
    ingested += 1;
  }

  // Pass 2: ProposalApproved -> RevenueConfirmed for any linked estimate still in "expected"
  for (const source of events) {
    if (source.type !== ProposalApproved) continue;
    const proposalId = source.payload.proposalId as string | undefined;
    if (proposalId === undefined) continue;

    // Find the estimate for this proposal.
    const target = events.find(
      (e) => e.type === RevenueEstimateCreated && e.payload.sourceProposalId === proposalId,
    );
    if (target === undefined) continue;
    const estimateId = target.payload.estimateId as string;

    // Replay to current state to check idempotency.
    const current = projectEstimate(events, estimateId);
    if (current === null) continue;
    const { events: intents } = confirmEstimate(current);
    for (const intent of intents) {
      await deps.eventStore.append(
        enrich(intent, {
          tenantId: cmd.tenantId,
          actor: deps.actor,
          newId: deps.newId,
          now: deps.now,
          lineage: followFrom(source),
        }),
      );
    }
    if (intents.length > 0) confirmed += 1;
  }

  // Pass 3: PaymentReceived -> RevenueReceived for any linked estimate in "expected"/"confirmed"
  for (const source of events) {
    if (source.type !== PaymentReceived) continue;
    const proposalId = source.payload.proposalId as string | undefined;
    if (proposalId === undefined) continue;

    const target = events.find(
      (e) => e.type === RevenueEstimateCreated && e.payload.sourceProposalId === proposalId,
    );
    if (target === undefined) continue;
    const estimateId = target.payload.estimateId as string;

    // Re-replay including any events appended in this same pass for accurate state.
    const currentEvents = await deps.eventStore.readStream(cmd.tenantId);
    const current = projectEstimate(currentEvents, estimateId);
    if (current === null) continue;
    const { events: intents } = receiveEstimate(current);
    for (const intent of intents) {
      await deps.eventStore.append(
        enrich(intent, {
          tenantId: cmd.tenantId,
          actor: deps.actor,
          newId: deps.newId,
          now: deps.now,
          lineage: followFrom(source),
        }),
      );
    }
    if (intents.length > 0) received += 1;
  }

  return { ingested, confirmed, received };
}

// Suppress unused-warning: DomainEvent is imported for clarity; the type is used implicitly.
export type { DomainEvent };