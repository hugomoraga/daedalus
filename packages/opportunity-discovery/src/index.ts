// @daedalus/opportunity-discovery — explicit public contract: use cases, command types,
// and the domain types strictly necessary to consume them.
// The adapter is NOT here — import it from "@daedalus/opportunity-discovery/adapters".
// Domain mutation functions and event-type constants are internal (not exported).

// Public types
export type { OpportunityDiscoveryDeps } from "./application/deps.ts";
export type { OpportunityStorePort } from "./application/ports/opportunity-store.ts";
export type { Opportunity, OpportunityState } from "./domain/opportunity.ts";
export type { OpportunityPipeline } from "./application/projections.ts";

// Command types
export type { SurfaceOpportunityCommand } from "./application/surface-opportunity.ts";
export type { EnrichOpportunityCommand } from "./application/enrich-opportunity.ts";
export type { QualifyOpportunityCommand } from "./application/qualify-opportunity.ts";
export type { DismissOpportunityCommand } from "./application/dismiss-opportunity.ts";

// Use cases
export { surfaceOpportunityUseCase } from "./application/surface-opportunity.ts";
export { enrichOpportunityUseCase } from "./application/enrich-opportunity.ts";
export { qualifyOpportunityUseCase } from "./application/qualify-opportunity.ts";
export { dismissOpportunityUseCase } from "./application/dismiss-opportunity.ts";

// Projection (read-model)
export { projectPipeline } from "./application/projections.ts";