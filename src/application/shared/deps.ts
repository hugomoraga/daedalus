// Dependencies injected into use cases. Keeps the application layer free of
// infrastructure and of non-deterministic globals (id/clock are injected for testability).

import type { EventStorePort } from "../ports/event-store.ts";
import type { DraftStorePort } from "../ports/draft-store.ts";

export type Deps = {
  eventStore: EventStorePort;
  draftStore: DraftStorePort;
  newId: () => string;
  now: () => string; // returns an ISO-8601 timestamp
  actor: string;
};
