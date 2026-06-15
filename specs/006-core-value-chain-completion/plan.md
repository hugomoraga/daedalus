# Plan — Core Value-Chain Completion v0 (implementation)

**Status:** Draft · implementation plan for [Spec 006](./spec.md)
**Goal:** Close the `Lead → Payment` Core value chain by implementing the 9 missing events and 2 new aggregates (Project, Invoice) with their lifecycle use cases and cross-aggregate reactors.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-14

> **Core completion, not a new module.** The 9 events live in `@daedalus/core`. Modules don't change (except: Revenue Visibility's reactor already handles `PaymentReceived`; we add a Core-level reactor for `InvoicePaid` here, which is purely Core-internal).

---

## 0. Q resolutions (from Spec 006 §11)

- **Q1 (close-with-unpaid reason):** free text. Recorded in `ProjectClosed.payload.reason`.
- **Q2 (partial payment → `paid`):** v0 treats any applied payment as a full transition to `paid`. Partial-payment semantics deferred (per Spec 001 / Event Catalog "out of scope" notes).
- **Q3 (`overdue` → `paid`):** a paid invoice retains its prior `InvoiceOverdue` events in the audit trail. The alert engine (Revenue Visibility) handles cleared-condition semantics.

---

## 1. Architecture

```
packages/core/                          # CHANGES: 9 new events, 2 new aggregates, ~7 new use cases
  src/domain/value-chain.ts             #   + ProposalSubmitted, ProposalRejected, ProjectCreated,
  src/domain/proposal.ts                #     ProjectDelivered, ProjectClosed, InvoiceIssued,
  src/domain/project.ts                 #     InvoiceSent, InvoicePaid, InvoiceOverdue
  src/domain/invoice.ts                 #   NEW aggregates
  src/application/projections.ts        #   + projectProposal, projectProject, projectInvoice
  src/application/deps.ts               #   (unchanged: CoreDeps still sufficient)
  src/application/submit-proposal.ts    #   new
  src/application/reject-proposal.ts    #   new
  src/application/create-project.ts     #   new (reactor from ProposalApproved)
  src/application/deliver-project.ts    #   new
  src/application/close-project.ts      #   new
  src/application/issue-invoice.ts      #   new (reactor from ProjectDelivered)
  src/application/send-invoice.ts       #   new
  src/application/pay-invoice.ts        #   new (reactor from PaymentReceived)
  src/application/overdue-invoice.ts    #   new
  src/index.ts                          #   expanded public contract
apps/cli/src/index.ts                   #   + 9 commands
tests/core-value-chain.test.ts          #   new
```

### Aggregates

**Proposal** (existing) — add `submitted` state, `submitProposal`, `rejectProposal` factories:
```
generated ──submit──► submitted ──approve──► approved  (terminal)
                  └─reject──► rejected  (terminal)
```

**Project** (new) — minimal lifecycle:
```
created ──deliver──► delivered ──close──► closed  (terminal)
```
`close` requires the project to be `delivered` and all linked invoices to be `paid` (or an explicit `reason` override per R2).

**Invoice** (new) — minimal lifecycle:
```
issued ──send──► sent ──pay──► paid  (terminal)
                └─overdue──► sent+overdue  (overdue is a flag, not a state)
```
`overdue` can be flagged from `issued` or `sent`. `paid` is terminal and reachable from any non-paid state.

### Cross-aggregate reactors (Core-internal)
- `createProjectUseCase` reacts to `ProposalApproved` → emits `ProjectCreated` (idempotent on `proposalId`).
- `issueInvoiceUseCase` reacts to `ProjectDelivered` → emits `InvoiceIssued` (idempotent on `projectId`).
- `payInvoiceUseCase` reacts to `PaymentReceived` → emits `InvoicePaid` (idempotent on `paymentId` per invoice).

Each reactor replays the stream to check for an existing derived event before emitting — the same `followFrom()` pattern that Revenue Visibility uses.

---

## 2. CLI commands (v0)

| Command | Use case | Emits / does |
|---|---|---|
| `proposal:submit --tenant t0 --proposal <id>` | submit-proposal | `ProposalSubmitted` |
| `proposal:reject --tenant t0 --proposal <id> --reason <r>` | reject-proposal | `ProposalRejected` |
| `project:create --tenant t0 --proposal <id>` | create-project (reactor) | `ProjectCreated` |
| `project:deliver --tenant t0 --project <id>` | deliver-project | `ProjectDelivered` |
| `project:close --tenant t0 --project <id> [--reason <r>]` | close-project | `ProjectClosed` |
| `invoice:issue --tenant t0 --project <id>` | issue-invoice (reactor) | `InvoiceIssued` |
| `invoice:send --tenant t0 --invoice <id>` | send-invoice | `InvoiceSent` |
| `invoice:pay --tenant t0 --invoice <id> --payment <id>` | pay-invoice (reactor) | `InvoicePaid` |
| `invoice:overdue --tenant t0 --invoice <id>` | overdue-invoice | `InvoiceOverdue` |

Plus status reads (read-only, no event):
| Command | Use case | Does |
|---|---|---|
| `proposal:status --tenant t0 --proposal <id>` | (read) | print proposal state |
| `project:status --tenant t0 --project <id>` | (read) | print project state + linked invoices |
| `invoice:status --tenant t0 --invoice <id>` | (read) | print invoice state + overdue flag |

---

## 3. Acceptance-criteria → test mapping

| Spec 006 AC | Test |
|---|---|
| AC-1 (proposal submit/reject lifecycle) | `tests/core-value-chain.test.ts` |
| AC-2 (project reactor from ProposalApproved) | same |
| AC-3 (project deliver/close, invariants) | same |
| AC-4 (invoice reactor from ProjectDelivered) | same |
| AC-5 (invoice send/overdue/paid) | same |
| AC-6 (auditability / replay) | same |
| AC-7 (tenant isolation) | same |
| AC-8 (cross-aggregate invariants) | same |
| AC-9 (end-to-end Lead → Payment) | same |

Plus: existing Core, Proposal Generation, Revenue Visibility, Opportunity Discovery tests stay green.

---

## 4. Evidence run (end-to-end Lead → Payment)

```
lead:create        t0 "ACME"      -> LeadCreated
lead:qualify       t0 <leadId>    -> LeadQualified
proposal:start     t0 <leadId>    -> ProposalDraftCreated
proposal:add-item  t0 <d> 1200
proposal:add-item  t0 <d> 4800
proposal:finalize  t0 <d>         -> ProposalGenerated(expectedValue=6000)
proposal:submit    t0 <p>         -> ProposalSubmitted
proposal:approve   t0 <p>         -> ProposalApproved
project:create     t0 <p>         -> ProjectCreated
project:deliver    t0 <proj>      -> ProjectDelivered
invoice:issue      t0 <proj>      -> InvoiceIssued
invoice:send       t0 <inv>       -> InvoiceSent
payment:record     t0 <p> pay-1 6000  -> PaymentReceived
invoice:pay        t0 <inv> pay-1      -> InvoicePaid
project:close      t0 <proj>      -> ProjectClosed
events             t0             -> full audit trail
```

Cross-tenant isolation: same flow for `tenant-other`; each sees only its own.

---

## 5. Definition of done

- All 9 new events implemented and emitted exactly once per transition.
- All 2 new aggregates with state machines, invariants, and projections.
- All 3 reactors idempotent on the trigger's `proposalId` / `projectId` / `paymentId`.
- All Spec 006 ACs covered by `node --test`.
- v0 + v1 + Spec 001/002/003 tests stay green.
- CLI contains no business logic; domain knows nothing of JSONL.
- `.data/` gitignored; no PII.

---

*Subordinate to [Spec 006](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Closes the value chain as documented.*