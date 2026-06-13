# Evidence — Revenue Visibility v0 (cross-module composition)

**Date:** 2026-06-13
**Spec:** [001 — Revenue Visibility](../../specs/001-revenue-visibility/spec.md) · **Plan:** [plan.md](../../specs/001-revenue-visibility/plan.md)
**Data:** synthetic only (no PII; `.data/` gitignored)

> This validates the first **cross-module composition**: Revenue Visibility reacts to Proposal Generation's `ProposalGenerated` event, records the `expectedValue` as expected revenue, and **preserves lineage** with `followFrom()` — no event bus, no workflow engine.

## Test suite

`node --test` → **17 passed, 0 failed** (12 prior + 5 RV: AC-RV-1..5).

## End-to-end CLI session

```
$ daedalus proposal:finalize --draft <id>
ProposalDraftFinalized + ProposalGenerated  proposal=0525ff0c…  expectedValue=6000 CLP

$ daedalus revenue:ingest --tenant tenant-0
revenue:ingest  ingested=1 estimate(s) from ProposalGenerated

$ daedalus revenue:ingest --tenant tenant-0      # idempotent
revenue:ingest  ingested=0 estimate(s) from ProposalGenerated

$ daedalus revenue:show --tenant tenant-0
expected revenue: 6000 CLP  (1 estimate(s))
```

## Lineage across modules

```
ProposalGenerated   eventId=ed97532f…  correlationId=41dceda4…  payload.expectedValue={6000,CLP}
   └─ followFrom() ─▶
RevenueEstimateCreated  causationId=ed97532f…  correlationId=41dceda4…  payload={sourceProposalId, amount:6000, currency:CLP, state:expected}
```

The estimate's `causationId` equals the proposal event's `eventId`, and both share the `correlationId` — the derived event can be traced back to its cause.

## What this proves

- **Modules compose over the event substrate.** Revenue Visibility consumed Proposal Generation's output through the public `ProposalGenerated` event only — no direct coupling between the modules.
- **`followFrom()` works.** Cross-module derived events carry correct lineage (shared correlation, causation set) without any bus.
- **Idempotent reactor.** Re-running `revenue:ingest` produces no duplicate estimates (one per proposal).
- **Read-model by replay.** `revenue:show` is a projection over the event stream; it stores no truth of its own.

## Out of scope (deferred, per the plan)

Confirmed/received lifecycle, expenses, approximate margin, runway, and alerts (the last two blocked on Spec 001 Q2/Q3). Manual revenue entry. No event bus / workflow / policy engine.

## Reproduce

```
npm install
node --test
# then the session above (finalize a proposal, revenue:ingest, revenue:show)
```
