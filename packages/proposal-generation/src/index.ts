// @daedalus/proposal-generation — explicit public contract: use cases, command types,
// and the domain types strictly necessary to consume them.
// The adapter is NOT here — import it from "@daedalus/proposal-generation/adapters".
// Domain mutation functions and event-type constants are internal (not exported).

// Public types
export type { ProposalDeps } from "./application/deps.ts";
export type { DraftStorePort } from "./application/ports/draft-store.ts";
export type { ProposalDraft, DraftState } from "./domain/proposal-draft.ts";
export type { ExpectedValue, PricingLineItem } from "./domain/value-objects.ts";

// Command types
export type { StartDraftCommand } from "./application/start-draft.ts";
export type { AddLineItemCommand } from "./application/add-line-item.ts";
export type { SetScopeCommand } from "./application/set-scope.ts";
export type { FinalizeDraftCommand } from "./application/finalize-draft.ts";
export type { DiscardDraftCommand } from "./application/discard-draft.ts";

// Use cases
export { startDraftUseCase } from "./application/start-draft.ts";
export { addLineItemUseCase } from "./application/add-line-item.ts";
export { setScopeUseCase } from "./application/set-scope.ts";
export { finalizeDraftUseCase } from "./application/finalize-draft.ts";
export { discardDraftUseCase } from "./application/discard-draft.ts";
