# Plan — Proposal Generation v0 (implementation)

**Status:** Draft · implementation plan for [Spec 002](./spec.md)
**Goal:** Get **real usage evidence** by building the smallest clean vertical slice — not more conceptual modeling.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md) ([ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md))
**Version:** 0.2.0
**Last updated:** 2026-06-13

> The `/plan` step: *how* we build Proposal Generation v0. The spec defines *what*. Code is now in scope. We build the leanest **hexagonal** slice that exercises the canonical chain and produces an auditable, replayable event trail.

---

## 1. Technical context (per the framework)

| Decision | Choice | Source |
|---|---|---|
| Language / runtime | TypeScript on Node.js | confirmed |
| Architecture | **Hexagonal** — Domain / Application / Ports / Adapters | Technical Principles §2 |
| Interface | **CLI** as first driving adapter, **no business logic** | Technical Principles · First-Phase |
| Persistence | **JSONL append-only, one file per tenant**, behind a port | Technical Principles · First-Phase |
| Event store | **`EventStorePort`** + **`JsonlEventStoreAdapter`** | Technical Principles · First-Phase |
| Dependencies | Minimal / zero external (`fs`, `node:test`, `node:util`) | Simplicity First |
| Testing | `node:test` encoding Spec 002 acceptance criteria | — |

---

## 2. Architecture — hexagonal in a modular monorepo

Built as a modular monorepo per [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md). `apps → packages`; within a package `adapters → application → domain`. `@daedalus/core` depends on nothing.

```
apps/cli/src/index.ts              # driving adapter: parse args -> Command -> use case -> render. NO logic.
packages/core/                     # @daedalus/core
  src/domain/                      #   event.ts, value-chain.ts, lead.ts (pure)
  src/application/                 #   create-lead, qualify-lead, projections, lineage, deps (CoreDeps)
  src/application/ports/           #   event-store.ts (EventStorePort)
packages/proposal-generation/      # @daedalus/proposal-generation (depends on core)
  src/domain/                      #   proposal-draft.ts, events.ts, value-objects.ts
  src/application/                 #   start/add-item/set-scope/finalize/discard, deps (ProposalDeps)
  src/application/ports/           #   draft-store.ts (DraftStorePort)
  src/adapters/                    #   json-draft-store.ts (module-specific driven adapter)
packages/jsonl-event-store/        # @daedalus/jsonl-event-store (shared driven adapter, impl EventStorePort)
config/tenants/tenant-0.ts         # currency, enabled modules (Tenant layer; NO PII)
.data/                             # gitignored: tenants/<id>/events.jsonl, tenants/<id>/drafts/<id>.json
```

> **Two ports, both earning their place** (Technical Principles §2, "ports earn their place"):
> - `EventStorePort` — the audit log; clearly swappable (SQLite/Postgres later).
> - `DraftStorePort` — the **mutable work-area**. Per Spec 002 §6, draft edits emit **no events** (to avoid log noise), so the working draft is *not* event-sourced; it needs its own persistence. Isolating it behind a port keeps the domain/use cases pure and the non-event state explicitly contained. This is a deliberate, documented exception to pure event-sourcing, scoped to the draft only.
>
> `id` and timestamp generation are passed into use cases as **injected functions** (not full ports) for test determinism — deliberately not over-abstracted.

### The canonical chain this slice proves
```
Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI
```

---

## 3. CLI commands (v0)

| Command | Use case | Emits / does |
|---|---|---|
| `lead:create --tenant t0 --customer "<name>"` | create-lead | `LeadCreated` (Core seed) |
| `lead:qualify --tenant t0 --lead <id>` | qualify-lead | `LeadQualified` (Core seed) |
| `proposal:start --tenant t0 --lead <id> --template <name>` | start-draft | `ProposalDraftCreated`; creates work-area |
| `proposal:add-item --tenant t0 --draft <id> --label "<l>" --amount <n>` | add-line-item | mutate draft (**no event**) |
| `proposal:set-scope --tenant t0 --draft <id> --text "<s>"` | set-scope | mutate draft (**no event**) |
| `proposal:show --tenant t0 --draft <id>` | (read) | print draft work-area |
| `proposal:finalize --tenant t0 --draft <id>` | finalize-draft | `ProposalDraftFinalized` + **one** `ProposalGenerated(expectedValue)` |
| `proposal:discard --tenant t0 --draft <id>` | discard-draft | `ProposalDraftDiscarded` |
| `events --tenant t0` | (read) | dump append-only log (**the evidence**) |

> **Lead seed is minimal, not a CRM** (review M2): two flat commands existing only to satisfy the "draft starts from a qualified lead" precondition. No pipeline/scoring/capture.
> **Cross-module contract** (review M3 / Spec 002 Q5): `ProposalGenerated` carries optional `expectedValue { amount, currency }` = sum of line items in tenant currency. No pricing engine, no tax.

---

## 4. Build steps (lean, inside-out per hexagonal)

1. **Domain core** — `Event` + lineage value objects; `value-chain` event factories; minimal `Lead` aggregate. *Pure, no I/O.*
2. **Ports** — define `EventStorePort` and `DraftStorePort` interfaces in `application/ports`.
3. **JSONL adapter** — `JsonlEventStoreAdapter` (append + readStream, tenant-scoped file). Test: append never mutates prior lines; readStream replays in order.
4. **Core seed use cases** — `create-lead`, `qualify-lead`. Test: a draft cannot start from an unqualified lead (AC-1 negative).
5. **Proposal draft domain + use cases** — `proposal-draft` aggregate, value objects; `start-draft`, `add-line-item`, `set-scope`. Test: edits go through `DraftStorePort`, emit no events (AC-4); start emits `ProposalDraftCreated` (AC-1).
6. **Finalize + discard use cases** — `finalize-draft` emits `ProposalDraftFinalized` + exactly one `ProposalGenerated` with `expectedValue` (AC-3, AC-5, R1); draft becomes non-editable. `discard-draft` emits `ProposalDraftDiscarded`, no Core Proposal (AC-6).
7. **CLI driving adapter** — `parseArgs` dispatch; builds Command DTOs; calls use cases; renders. `events` dumps the log. *No business logic in CLI.*
8. **Evidence run + isolation + replay** — scripted end-to-end session (below); two-tenant isolation (AC-9); full-log replay reconstructs state (AC-7).
9. **`.gitignore`** — add `.data/` (no runtime/tenant data, no PII in VC).

---

## 5. The evidence we capture (the point)

A recorded end-to-end session (synthetic data only), committed as a transcript:

```
lead:create   t0 "ACME (mock)"        -> LeadCreated
lead:qualify  t0 <leadId>             -> LeadQualified
proposal:start t0 <leadId> standard   -> ProposalDraftCreated
proposal:add-item t0 <draftId> "Discovery" 1200
proposal:add-item t0 <draftId> "Build" 4800
proposal:finalize t0 <draftId>        -> ProposalDraftFinalized + ProposalGenerated(expectedValue=6000)
events t0                             -> append-only audit trail printed
```

Demonstrates the canonical chain end to end: tenant-scoped immutable events, the read-model draft (no event noise), the clean Module→Core handoff, and the `expectedValue` contract ready for Revenue Visibility. **This is the validation evidence** — concrete, auditable, replayable, and reusable for any future module.

---

## 6. Acceptance-criteria → test mapping

| Spec 002 AC | Covered by |
|---|---|
| AC-1 (start from qualified lead; reject otherwise) | Steps 4 + 5 |
| AC-3 (expectedValue = sum of items, no tax) | Step 6 |
| AC-4 (edits emit no event) | Step 5 |
| AC-5 (finalize → single ProposalGenerated) | Step 6 (R1) |
| AC-6 (discard, no Core Proposal) | Step 6 |
| AC-7 (auditability; replay reconstructs) | Steps 3 + 8 |
| AC-8 (expectedValue contract for RV) | Step 6 (emits contract; consumed when Spec 001 is built) |
| AC-9 (tenant isolation) | Step 8 |

---

## 7. Scope guardrails (do NOT build in v0)

- No CRM/pipeline/scoring (lead seed = two flat commands).
- No pricing engine, discounts, or tax (`expectedValue` is a sum).
- No sending, e-signature, or contract generation.
- No AI drafting; no orchestration/workflow engine (Phase 2).
- No UI; no real client data / PII (`.data/` gitignored; templates are mock).
- No Revenue Visibility implementation here (v0 only emits the contract).
- From the framework's "avoid" list: no CQRS, sagas, DI framework, relational DB, event bus, etc.

---

## 8. Definition of done (v0)

- The canonical chain `Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI` runs cleanly for the evidence session.
- All acceptance-criteria tests pass (`node --test`).
- Finalize emits exactly one `ProposalGenerated` carrying `expectedValue`.
- State is reconstructable by replaying the JSONL log; two tenants show zero cross-leakage.
- CLI contains no business logic; domain knows nothing of JSONL.
- `.data/` gitignored; no PII in the repo.

---

*Subordinate to [Spec 002](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Implementation plan only — the build is the next step.*
