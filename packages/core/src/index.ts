// @daedalus/core — explicit public contract.
// Internals (domain factory functions like createLead/qualifyLead, value-chain internals)
// are intentionally NOT exported. Consumers depend on this surface only.

// Contracts (types)
export type { DomainEvent, EventIntent } from "./domain/event.ts";
export type { Lead, LeadState } from "./domain/lead.ts";
export type { EventStorePort } from "./application/ports/event-store.ts";
export type { CoreDeps } from "./application/deps.ts";
export type { Lineage } from "./application/lineage.ts";
export type { CreateLeadCommand } from "./application/create-lead.ts";
export type { QualifyLeadCommand } from "./application/qualify-lead.ts";

// Value-chain event type identifiers (the public event vocabulary)
export { LeadCreated, LeadQualified, ProposalGenerated } from "./domain/value-chain.ts";

// Application kernel — modules build on these to emit lineage-bearing events
export { enrich, appendIntents, startLineage, followFrom } from "./application/lineage.ts";
export { projectLead } from "./application/projections.ts";

// Core use cases
export { createLeadUseCase } from "./application/create-lead.ts";
export { qualifyLeadUseCase } from "./application/qualify-lead.ts";
