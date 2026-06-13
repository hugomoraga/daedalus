// Core dependency kernel injected into use cases. Free of infrastructure and of
// non-deterministic globals (id/clock are injected for testability).
// Modules extend this (e.g. proposal-generation adds a DraftStorePort) — the Core
// never depends on a module's ports (Generic Core, Specific Tenants).

import type { EventStorePort } from "./ports/event-store.ts";

export type CoreDeps = {
  eventStore: EventStorePort;
  newId: () => string;
  now: () => string; // returns an ISO-8601 timestamp
  actor: string;
};
