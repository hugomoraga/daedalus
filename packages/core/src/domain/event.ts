// Core domain — the Event. First-class citizen (Constitution: Everything is an Event).
// Pure types. No I/O, no infrastructure.

// A persisted, immutable domain event with full lineage.
// Lineage fields make events traceable and let derived events (across modules) be followed:
//   - causationId: the eventId of the event/command that directly caused this one (null at flow origin)
//   - correlationId: shared across every event in one logical flow, so a chain can be reconstructed
export type DomainEvent = {
  eventId: string;
  type: string;
  tenantId: string;
  occurredAt: string; // ISO-8601
  actor: string;
  causationId: string | null;
  correlationId: string;
  payload: Record<string, unknown>;
};

// What an aggregate emits: a fact (type + payload) with no lineage yet.
// The application layer enriches it into a DomainEvent.
export type EventIntent = {
  type: string;
  payload: Record<string, unknown>;
};
