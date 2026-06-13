# events/

Canonical event definitions — the vocabulary of organizational state changes.

By constitution, *Everything is an Event* (Principle 3): organizational state changes through explicit, immutable, append-only events. Current state is a projection of the event stream; the Audit Log is its durable record.

## Relationship to the catalog
The narrative catalog and rationale live in [`docs/event-catalog.md`](../../docs/event-catalog.md). This directory holds the **formal definitions** once they exist. The catalog explains *why* each event matters; `events/` defines *what* each event is.

> **Flagged for human review (single source of truth):** before Phase 1, confirm the split — `docs/event-catalog.md` as narrative/rationale, `events/` as formal definitions linked from the catalog — to prevent two drifting copies.

## Conventions
- Naming: `Subject` + past-tense verb (`LeadCreated`, `InvoicePaid`).
- Immutable: corrections are new compensating events, never edits.
- Every event carries tenant, actor, cause, and authorizing policy.

*Activated in Phase 1 (Organizational Core). Empty scaffolding in Phase 0.*
