// Core domain — the Event. First-class citizen (Constitution: Everything is an Event).
// Pure types. No I/O, no infrastructure.

// A persisted, immutable domain event with full lineage.
export type DomainEvent = {
  id: string;
  type: string;
  tenantId: string;
  occurredAt: string; // ISO-8601
  actor: string;
  cause: string | null; // id of the triggering event/command, if any
  payload: Record<string, unknown>;
};

// What an aggregate emits: a fact (type + payload) with no lineage yet.
// The application layer enriches it into a DomainEvent.
export type EventIntent = {
  type: string;
  payload: Record<string, unknown>;
};
