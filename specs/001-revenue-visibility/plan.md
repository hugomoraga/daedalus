# Plan — Revenue Visibility v0 (implementation)

**Status:** Draft · implementation plan for [Spec 001](./spec.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-13

> **Slice scope (deliberately narrow).** This v0 builds **only** the cross-module composition: Revenue Visibility consumes `ProposalGenerated.expectedValue` and records it as **expected revenue**, preserving lineage with `followFrom()`. It is the highest-value, lowest-ambiguity part of Spec 001 and validates that one module can react to another's events cleanly.
>
> **Explicitly deferred** (not in this slice): the `confirmed`/`received` lifecycle, expenses, approximate margin, **runway** and **alerts** — the latter blocked on Spec 001 open questions Q2 (runway basis) and Q3 (runway formula). No new features beyond the composition.

---

## 1. What we build

A new package `@daedalus/revenue-visibility` that:
- **reacts** to `ProposalGenerated` events and emits a derived `RevenueEstimateCreated` (state `expected`) per proposal, using `followFrom(sourceEvent)` so the estimate shares the proposal's `correlationId` and sets `causationId` to the proposal event's `eventId`;
- is **idempotent**: re-running never double-counts (a `ProposalGenerated` whose `proposalId` already has an estimate is skipped);
- exposes a **read-model** `projectExpectedRevenue(events)` (total expected revenue + count), reconstructed by replay.

No event bus: the reaction is an explicit, replayable **reactor** invoked from the CLI (`revenue:ingest`). This honors "no workflow engine / no event bus" while proving derived events work.

---

## 2. Architecture (hexagonal, in the monorepo)

```
packages/revenue-visibility/            # @daedalus/revenue-visibility (depends on @daedalus/core)
  src/domain/events.ts                  #   RevenueEstimateCreated (internal constant)
  src/domain/revenue.ts                 #   RevenueState ("expected" in v0)
  src/application/ingest-proposal-revenue.ts  # reactor use case (uses enrich + followFrom)
  src/application/projections.ts        #   projectExpectedRevenue -> RevenueSummary
  src/index.ts                          #   public contract: use case + projection + types
```

- **Deps:** `CoreDeps` (eventStore + newId/now/actor) — RV needs no extra port, so no new deps type.
- **No adapter:** RV reads/writes only through `EventStorePort`; the CLI wires the concrete JSONL adapter.
- **Public contract:** `ingestProposalRevenueUseCase`, `projectExpectedRevenue`, `RevenueSummary`, `IngestProposalRevenueCommand`, `RevenueState`. The event constant stays internal.

### Lineage (the point of the slice)
```
ProposalGenerated(correlationId=C, eventId=P, payload.expectedValue)
   └─ reactor → RevenueEstimateCreated(correlationId=C, causationId=P, payload.sourceProposalId, amount, currency, state=expected)
```

---

## 3. CLI (two commands)

| Command | Use case | Does |
|---|---|---|
| `revenue:ingest --tenant t0` | ingest-proposal-revenue | derives estimates from new `ProposalGenerated` events (`RevenueEstimateCreated`) |
| `revenue:show --tenant t0` | (read) | prints expected revenue total + count from the projection |

---

## 4. Acceptance criteria (tests, `node:test`)

- **AC-RV-1 (composition):** after finalizing a proposal with `expectedValue`, `revenue:ingest` emits exactly one `RevenueEstimateCreated` with `amount`/`currency` = the proposal's `expectedValue` and `sourceProposalId` set.
- **AC-RV-2 (lineage / followFrom):** the `RevenueEstimateCreated` shares the source `ProposalGenerated`'s `correlationId` and its `causationId` equals the proposal event's `eventId`.
- **AC-RV-3 (idempotent):** running ingest twice yields one estimate per proposal.
- **AC-RV-4 (projection):** `projectExpectedRevenue` sums expected estimates; reconstructable by replay.
- **AC-RV-5 (isolation):** estimates are tenant-scoped (no cross-tenant leakage).

---

## 5. Non-goals (this slice)

- No `confirmed`/`received` lifecycle, no expenses, no margin, no runway, no alerts, no snapshots.
- No manual revenue entry (only the derived-from-proposal path).
- No event bus, workflow engine, or policy engine; no API/UI/DB.
- Spec 001 open questions Q2/Q3 (runway) stay open — not needed here.

---

## 6. Definition of done

- `node --test` green (existing + new RV tests).
- `revenue:ingest` then `revenue:show` reflect a finalized proposal's expected value.
- `RevenueEstimateCreated` carries lineage tying it to its `ProposalGenerated` (shared correlationId, causation = proposal eventId).
- Idempotent ingest; tenant-isolated; evidence run recorded.

---

*Subordinate to [Spec 001](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Narrow composition slice; runway/alerts deferred.*
