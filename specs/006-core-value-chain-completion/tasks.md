# Tasks — Core Value-Chain Completion

**Status:** v0 **shipped & green** (PR #14 — `012-core-value-chain-completion`, merged `e705d19`)
**Derives from:** Spec 006 + Plan 006
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.2.0
**Last updated:** 2026-06-15

> The `/tasks` step for closing the Core value chain `Lead → Payment`. Tasks map to Spec 006 acceptance criteria and Plan 006 build steps. **All v0 tasks shipped**; nothing pending for Phase 1.

---

## 1. Reality check (verified, not assumed)

v0 is built and passing (`node --test` green; 88 tests). The Core value chain `Lead → Payment` is now an end-to-end event stream with the 14 events from the [Event Catalog](../../docs/event-catalog.md). The 9 new events and 2 new aggregates (`Project`, `Invoice`) plus the 3 internal Core reactors (`create-project`, `issue-invoice`, `pay-invoice`) are live; the CLI exposes the 9 commands + 3 status reads. Cross-aggregate invariants, idempotency on trigger keys, and tenant isolation are covered by `tests/core-value-chain.test.ts`.

---

## 2. v0 build (Phase 1) — DONE

Each task maps to a Spec 006 AC and a Plan 006 build step.

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-01 | Domain: `ProposalSubmitted` + `ProposalRejected` event types; extend `Proposal` aggregate (add `submitted` state) | AC-1 | ✅ |
| T-02 | Domain: `Project` aggregate (created/delivered/closed), state machine | AC-2, AC-3 | ✅ |
| T-03 | Domain: `Invoice` aggregate (issued/sent/paid/overdue), state machine | AC-4, AC-5 | ✅ |
| T-04 | Projections: `projectProposal`, `projectProject`, `projectInvoice` (replay-based) | AC-6 | ✅ |
| T-05 | Use case: `submitProposalUseCase` (idempotent on `submitted`/`approved`/`rejected`) | AC-1 | ✅ |
| T-06 | Use case: `rejectProposalUseCase` (idempotent; requires non-empty reason) | AC-1 | ✅ |
| T-07 | Use case: `createProjectUseCase` — reactor from `ProposalApproved`; idempotent on `proposalId` | AC-2, AC-8 | ✅ |
| T-08 | Use case: `markProjectDeliveredUseCase` (state machine invariant) | AC-3 | ✅ |
| T-09 | Use case: `closeProjectUseCase` — requires delivered + invoices paid (or explicit reason) | AC-3, AC-8, R2 | ✅ |
| T-10 | Use case: `issueInvoiceUseCase` — reactor from `ProjectDelivered`; idempotent on `projectId`; requires project=delivered | AC-4, AC-8 | ✅ |
| T-11 | Use case: `sendInvoiceUseCase` (state machine invariant) | AC-5 | ✅ |
| T-12 | Use case: `payInvoiceUseCase` — reactor from `PaymentReceived`; idempotent on `(invoiceId, paymentId)` | AC-5 | ✅ |
| T-13 | Use case: `markInvoiceOverdueUseCase` (flag, not state; multiple times allowed) | AC-5 | ✅ |
| T-14 | CLI: 9 commands + 3 status reads | — | ✅ |
| T-15 | Tests: AC-1..AC-9 + evidence run | all | ✅ |

---

## 3. Out of scope (binding — from Spec 006 §9)

- No real invoicing (no PDF, no tax, no SII)
- No payments processing
- No project management (tasks, milestones, delivery proofs)
- No invoice tax / multi-currency
- No automated overdue detection (Phase 2)
- No UI / API / schema
- No additions to Constitution, Domain Model identity, or Memory

---

## 4. Q resolutions (carried from Plan 006 §0)

- **Q1:** close-with-unpaid reason is free text.
- **Q2:** any applied payment transitions to `paid` (no partial-payment semantics in v0).
- **Q3:** `paid` invoice retains prior `InvoiceOverdue` events in the audit trail; cleared-condition semantics live in the alert engine (Revenue Visibility).

---

## 5. Module impact (forward-compatibility note)

- **Revenue Visibility v1 reactor** already reacts to `PaymentReceived` and emits `RevenueReceived`. The new `payInvoiceUseCase` is a **Core-internal** reactor (also reacting to `PaymentReceived`) that emits `InvoicePaid`. Both can coexist: each is idempotent on its own key. The v1 reactor is unchanged.
- **Opportunity Discovery, Proposal Generation** unchanged.
- **Tax & Compliance Guard (#4)**, **Administrative Shield (#5)** are still blocked on Phase 3/4 capabilities.

---

*Subordinate to [Spec 006](./spec.md) and [Plan 006](./plan.md). Build authorized; not started.*