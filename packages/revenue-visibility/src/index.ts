// @daedalus/revenue-visibility — explicit public contract.
// The event-type constant is internal; consumers use the use case and projection.

export type { RevenueState } from "./domain/revenue.ts";
export type { RevenueSummary } from "./application/projections.ts";
export type { IngestProposalRevenueCommand } from "./application/ingest-proposal-revenue.ts";

export { ingestProposalRevenueUseCase } from "./application/ingest-proposal-revenue.ts";
export { projectExpectedRevenue } from "./application/projections.ts";
