# Evidence — Proposal Generation v0

**Date:** 2026-06-13
**Spec:** [002 — Proposal Generation](../../specs/002-proposal-generation/spec.md) · **Plan:** [plan.md](../../specs/002-proposal-generation/plan.md)
**Data:** synthetic only (no PII; `.data/` is gitignored)

> This is the validation evidence: a real run of the canonical chain
> `Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI`,
> proving Daedalus can execute the pattern cleanly. If it works here, it is reusable for any
> future module — independent of the final mission or root entity (ADR-001).

## Test suite

`node --test` → **11 passed, 0 failed**, covering Spec 002 AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9 and the R1 (no-duplication) guarantee.

## End-to-end CLI session

```
$ daedalus lead:create   --tenant tenant-0 --customer "ACME (mock)"
LeadCreated  lead=c9831cd7…

$ daedalus lead:qualify  --tenant tenant-0 --lead c9831cd7…
LeadQualified  lead=c9831cd7…

$ daedalus proposal:start --tenant tenant-0 --lead c9831cd7… --template standard
ProposalDraftCreated  draft=c2161e52…

$ daedalus proposal:add-item --draft c2161e52… --label "Discovery" --amount 1200
item added (no event)

$ daedalus proposal:add-item --draft c2161e52… --label "Build" --amount 4800
item added (no event)

$ daedalus proposal:finalize --draft c2161e52…
ProposalDraftFinalized + ProposalGenerated  proposal=6793885c…  expectedValue=6000 CLP
```

## Resulting audit trail (`daedalus events --tenant tenant-0`)

```
LeadCreated            {"leadId":"c9831cd7…","customer":"ACME (mock)"}
LeadQualified          {"leadId":"c9831cd7…"}
ProposalDraftCreated   {"draftId":"c2161e52…","leadId":"c9831cd7…","template":"standard"}
ProposalDraftFinalized {"draftId":"c2161e52…"}
ProposalGenerated      {"proposalId":"6793885c…","leadId":"c9831cd7…","draftId":"c2161e52…","expectedValue":{"amount":6000,"currency":"CLP"}}
```

## What this proves

- **Event-First works.** Five auditable, append-only, tenant-scoped events with full lineage (id, type, tenantId, occurredAt, actor, cause, payload).
- **The draft is a read-model (Spec 002 §6).** The two `add-item` edits emitted **no** events — only deliberate milestones did.
- **Clean Module → Core handoff.** `finalize` emitted the module's `ProposalDraftFinalized` **and exactly one** Core `ProposalGenerated` (no duplication, R1).
- **Cross-module contract ready.** `ProposalGenerated` carries `expectedValue {amount, currency}` for Revenue Visibility (Spec 001) to consume later.
- **State is reconstructable** by replaying the log (validated by the AC-7 test).
- **Hexagonal boundaries hold.** The CLI has no business logic; the domain knows nothing of JSONL; persistence is reachable only through `EventStorePort` / `DraftStorePort`.

## Reproduce

```
node --test                     # acceptance criteria
node src/adapters/cli/index.ts  # prints usage; run the session above
```
