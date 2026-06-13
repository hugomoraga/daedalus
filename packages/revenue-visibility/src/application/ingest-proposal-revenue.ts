// Reactor use case: derive expected revenue from ProposalGenerated events.
// This is the cross-module composition — Revenue Visibility reacting to Proposal Generation,
// with lineage preserved via followFrom() (no event bus, no workflow engine).
// Idempotent: a proposal already turned into an estimate is skipped.

import { enrich, followFrom, ProposalGenerated } from "@daedalus/core";
import type { CoreDeps, DomainEvent } from "@daedalus/core";
import { RevenueEstimateCreated } from "../domain/events.ts";

export type IngestProposalRevenueCommand = {
  tenantId: string;
};

type ExpectedValue = { amount: number; currency: string };

export async function ingestProposalRevenueUseCase(
  deps: CoreDeps,
  cmd: IngestProposalRevenueCommand,
): Promise<{ ingested: number }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);

  const alreadyIngested = new Set(
    events
      .filter((e) => e.type === RevenueEstimateCreated)
      .map((e) => e.payload.sourceProposalId as string),
  );

  const sources: DomainEvent[] = events.filter(
    (e) => e.type === ProposalGenerated && !alreadyIngested.has(e.payload.proposalId as string),
  );

  let ingested = 0;
  for (const source of sources) {
    const expectedValue = source.payload.expectedValue as ExpectedValue | undefined;
    if (expectedValue === undefined) continue; // a proposal with no priced value contributes nothing

    await deps.eventStore.append(
      enrich(
        {
          type: RevenueEstimateCreated,
          payload: {
            estimateId: deps.newId(),
            sourceProposalId: source.payload.proposalId,
            amount: expectedValue.amount,
            currency: expectedValue.currency,
            state: "expected",
          },
        },
        { tenantId: cmd.tenantId, actor: deps.actor, newId: deps.newId, now: deps.now, lineage: followFrom(source) },
      ),
    );
    ingested += 1;
  }

  return { ingested };
}
