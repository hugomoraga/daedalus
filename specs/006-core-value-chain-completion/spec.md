# Spec 006 — Core Value-Chain Completion

**Status:** Ratified · Phase 1 (implementation)
**Type:** Core event/aggregate completion (not a Module — it fills gaps in the generic Core value chain)
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-14

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* the Core must do and *why*, not *how*. Conceptual domain language only — no code, no schema, no API, no UI.

> **Context.** The [Event Catalog](../../docs/event-catalog.md) lists 14 value-chain events. The first three modules (Proposal Generation, Revenue Visibility v0, Revenue Visibility v1) only needed 6 of them and added them to Core: `LeadCreated/Qualified/Discarded`, `ProposalGenerated/Approved`, `PaymentReceived`. **9 remain** — completing the `Lead → Payment` chain. This spec defines them.

---

## 1. Summary

Complete the Core value chain `Lead → Proposal → Approval → Project → Delivery → Invoice → Payment` by adding the missing 9 events and 2 new aggregates (`Project`, `Invoice`). Existing modules already react to the events they need; this spec closes the chain so the whole Lead→Payment flow is replayable end to end.

The 9 events to add:

- **Commercial (2):** `ProposalSubmitted`, `ProposalRejected`
- **Delivery & Billing (7):** `ProjectCreated`, `ProjectDelivered`, `ProjectClosed`, `InvoiceIssued`, `InvoiceSent`, `InvoicePaid`, `InvoiceOverdue`

> **What this is NOT.** This is **not** a new module and not a new bounded context. It is **Core completion** — filling the gaps the modules revealed. No new tenant-specific concerns, no new module events.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates to it |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Everything is an Event* (every step of the value chain is an event — closes the audit trail); *Generic Core, Specific Tenants* (this is Core, not a Module); *Simplicity First* (only the minimum needed). |
| **[Domain Model](../../docs/domain-model.md)** | Realizes the `Project` and `Invoice` aggregates in the **Delivery & Billing** context. Honors §7 future-extension markers: this implements only what's listed in the spec, not every entry in §7. |
| **[Event Catalog](../../docs/event-catalog.md)** | Implements the 9 `[deferred]` / `[implemented in v1 of Revenue Visibility]` value-chain events. The catalog remains the source of truth for vocabulary; this spec adds the implementation. |
| **Modules (001, 002, 003)** | Each module already reacts to its needed events. Adding the missing events is forward-compatible — modules that today need manual bridging (e.g. an operator creating a Project after a ProposalApproved) will gain a Core path. |

---

## 3. Goals

1. **Close the chain** `Lead → Payment` so every step is a Core event with full lineage.
2. **Add the `Project` and `Invoice` aggregates** with the minimum lifecycle needed to record the events.
3. **Validate cross-aggregate reactions** at the Core level: a `ProposalApproved` reactor produces `ProjectCreated`; a `ProjectDelivered` reactor produces `InvoiceIssued`; a `PaymentReceived` reactor (already in v1) produces `InvoicePaid`.
4. **Preserve event-first discipline**: every transition emits an event; no projection-only state.
5. **Stay generic** — no Module/tenant-specific behavior leaks into Core (Principle 10).

---

## 4. Core / Module / Tenant split

### Lives in the **Core** (defined here)
- Two new aggregates: `Project`, `Invoice`.
- The 9 missing events, with their minimal use cases.
- Reactions between Core events (e.g. `ProposalApproved` → `ProjectCreated`) — these are **Core reactors** that produce Core events, not module events. They keep the Core self-consistent.

### Lives in the **Module** (unchanged)
- Revenue Visibility will gain a reactor for `InvoicePaid` (v2, optional): when an invoice is paid, transition the linked estimate from `confirmed` to `received`. This is forward-compatible — the v1 reactor on `PaymentReceived` is the current source of truth.
- Other modules (Opportunity Discovery, Proposal Generation, Tax & Compliance Guard) may grow in future specs.

### Lives in the **Tenant** (unchanged)
- None of these events are tenant-specific. The aggregates don't carry tenant-shaped concepts (no customer type, no industry, no product catalog). Per Constitution Principle 10, all of this stays Core.

---

## 5. Domain concepts (conceptual — no schema)

### Project (aggregate root)
A committed engagement, created when a `Proposal` is approved.
- **Owns:** no children aggregates (it terminates in Invoices which are siblings, not children).
- **Created from:** exactly one approved `Proposal` (the handoff).
- **Lifecycle (state machine):** `created` → `delivered` → `closed`. `delivered` is required before `closed` (you cannot bill or close work that wasn't delivered). `closed` is terminal.

### Invoice (aggregate root)
A demand for payment, issued against a delivered `Project`.
- **Owns:** no children aggregates.
- **Issued for:** exactly one delivered `Project`.
- **Lifecycle (state machine):** `issued` → `sent` → `paid` (or `issued` → `overdue` if payment terms lapse). `paid` is terminal. `overdue` is a risk signal (alertable, human-actionable), not terminal — the invoice can still be paid.
- **Settlement via `PaymentReceived` + `InvoicePaid`.** The distinction (per the Event Catalog): `PaymentReceived` records money movement; `InvoicePaid` records the *application* of that payment to this invoice. They can diverge (partial payment, overpayment, payment to the wrong invoice). Core keeps them distinct.

### Proposal lifecycle (existing aggregate, new transitions)
- `Generated` (existing) → `Submitted` → `Approved` (existing) or `Rejected` (terminal).
- `Submitted` marks the boundary from internal drafting to external exposure.
- `Rejected` is a terminal negative outcome (closes the branch with a reason).

---

## 6. Events

### New Core events (9)

| Event | Emitted when | Rationale |
|---|---|---|
| `ProposalSubmitted` | A proposal is sent to the customer. | Marks the boundary between internal drafting and external exposure — a different accountability regime begins here. |
| `ProposalRejected` | The proposal is declined (with reason). | Closes the branch. Essential for win/loss analysis. |
| `ProjectCreated` | An approved proposal becomes committed work. | The organization now owes delivery. Reactor from `ProposalApproved`. |
| `ProjectDelivered` | The committed work is completed. | Pre-condition for legitimate invoicing. |
| `ProjectClosed` | The project is formally concluded. | Bookend of the engagement lifecycle (after billing settles). |
| `InvoiceIssued` | A demand for payment is created. | Anti-fraud / anti-error anchor: every invoice must trace to a delivered project. Reactor from `ProjectDelivered`. |
| `InvoiceSent` | The invoice is delivered to the customer. | Starts payment-term clocks. |
| `InvoicePaid` | A payment is applied to the invoice. | Reactor from `PaymentReceived`; closes the loop opened by `LeadCreated`. |
| `InvoiceOverdue` | Payment terms lapse without settlement. | Risk signal. Auditable so dunning/collections are themselves governed. |

### Core reactors (in the use cases, not separate code)

| Reactor | Trigger | Effect |
|---|---|---|
| `createProjectUseCase` | when `ProposalApproved` is emitted | emits `ProjectCreated` (idempotent on `proposalId`) |
| `issueInvoiceUseCase` | when `ProjectDelivered` is emitted | emits `InvoiceIssued` (idempotent on `projectId`) |
| `applyPaymentToInvoiceUseCase` | when `PaymentReceived` is emitted | emits `InvoicePaid` (idempotent on `paymentId` per invoice) |

> **No event bus, no workflow engine.** The reactor pattern is the same as `ingestProposalRevenueUseCase` — an explicit, replayable, idempotent use case invoked from the CLI or (in Phase 2) by a workflow.

### The "manual" use cases (not reactors)
- `submitProposalUseCase` — explicit human act of sending a proposal.
- `rejectProposalUseCase` — explicit decision to decline (with reason).
- `markProjectDeliveredUseCase` — explicit confirmation that work is done.
- `closeProjectUseCase` — explicit close (requires delivered + paid or explicit reason).
- `sendInvoiceUseCase` — explicit act of sending the invoice.
- `markInvoiceOverdueUseCase` — explicit flag when terms lapse (typically scheduled in Phase 2; manual in v0).

---

## 7. State machine constraints (binding)

- **Proposal:** `generated` → (`submitted` → (`approved` | `rejected`)). Once `rejected` or `approved`, terminal.
- **Project:** `created` → `delivered` → `closed`. `closed` is terminal.
- **Invoice:** `issued` → `sent` → `paid` (terminal). `overdue` is a flag, not a state — an `issued`/`sent` invoice can also be `overdue`. Paid is always terminal.

Cross-aggregate rules:
- A `Project` cannot be created without a `ProposalApproved` event (replay-based check).
- An `Invoice` cannot be issued for a `Project` that is not `delivered`.
- A `Project` cannot be closed while any of its `Invoices` is `issued` or `sent` (unpaid).

---

## 8. Acceptance criteria

**AC-1 (Proposal lifecycle):**
- *Given* a `Proposal` in `generated` state, *when* `submitProposalUseCase` is invoked, *then* `ProposalSubmitted` is emitted and the state becomes `submitted`.
- *Given* a `Proposal` in `submitted` state, *when* `rejectProposalUseCase` is invoked with a reason, *then* `ProposalRejected` is emitted and the state becomes `rejected` (terminal).
- Re-submitting, re-rejecting, or transitioning a `rejected`/`approved` proposal is rejected.

**AC-2 (Project reactor):**
- *Given* a `ProposalApproved` event, *when* `createProjectUseCase` runs, *then* `ProjectCreated` is emitted exactly once with `state=created`, `proposalId` linking back, and `leadId`/`customer` carried from the proposal.
- Running the reactor twice for the same `proposalId` is a no-op (idempotent).

**AC-3 (Project manual):**
- *Given* a `Project` in `created` state, *when* `markProjectDeliveredUseCase` runs, *then* `ProjectDelivered` is emitted and state becomes `delivered`.
- *Given* a delivered project whose invoices are paid, *when* `closeProjectUseCase` runs, *then* `ProjectClosed` is emitted and state becomes `closed`.
- Closing a `created` or `delivered` project with unpaid invoices is rejected (the reason must be supplied to override).

**AC-4 (Invoice reactor):**
- *Given* a `ProjectDelivered` event, *when* `issueInvoiceUseCase` runs, *then* `InvoiceIssued` is emitted exactly once with `state=issued`, `projectId` linking back, and `amount`/`currency` from the proposal's `expectedValue`.
- Running the reactor twice for the same `projectId` is a no-op.

**AC-5 (Invoice manual):**
- *Given* an `issued` invoice, *when* `sendInvoiceUseCase` runs, *then* `InvoiceSent` is emitted and state becomes `sent`.
- *Given* a `sent` invoice, *when* `markInvoiceOverdueUseCase` runs, *then* `InvoiceOverdue` is emitted (the state remains `sent` — overdue is a flag, not a transition).
- *Given* a `sent` or `overdue` invoice, *when* `applyPaymentToInvoiceUseCase` runs (typically via the reactor from `PaymentReceived`), *then* `InvoicePaid` is emitted and state becomes `paid` (terminal).

**AC-6 (auditability):**
- *Given* any of the 9 new events, *then* it carries tenant, actor, correlationId, causationId, and payload; the event is appended to the Audit Log immutably.
- *Given* the event stream, *when* replayed, *then* every aggregate's state is fully reconstructable.

**AC-7 (tenant isolation):**
- *Given* two tenants, *when* each runs the value chain, *then* no events cross the boundary; no shared state.

**AC-8 (cross-aggregate invariants):**
- A `Project` cannot be created without `ProposalApproved` (replay check).
- An `Invoice` cannot be issued for a `Project` not in `delivered` state.
- A `Project` cannot be closed with unpaid `Invoices` (the only override is an explicit reason that records a human decision).

**AC-9 (end-to-end value chain):**
- *Given* the full chain `Lead → Proposal → Approved → Project → Delivered → Invoice → Paid`, *when* each transition is exercised (manual or via reactor), *then* every transition appears in the audit trail with lineage tying it back to the prior event.

---

## 9. Non-goals (binding)

- **No real invoicing** (no PDF generation, no tax computation, no SII, no e-invoicing). The aggregate is a *record*, not an artifact.
- **No payments processing.** `PaymentReceived` is recorded by the existing Core v1 use case; no integration with banks or processors.
- **No project management.** Project is a record, not a system of tasks/milestones. (Per Domain Model §7: a future extension.)
- **No invoice tax / multi-currency.** Single tenant currency (configured).
- **No automated overdue detection.** Manual `markInvoiceOverdueUseCase` only; scheduled detection is a Phase 2 concern.
- **No delivery proof / acceptance workflow.** `markProjectDelivered` is a single human act.
- **No UI, API, schema, or code in this spec (spec-first).**
- **No additions to the Constitution, Domain Model identity, or Memory.** This spec implements the catalog and domain model as documented.

---

## 10. Risks

- **R1 — Idempotency at the Core.** Every reactor (Project from Proposal, Invoice from Project, InvoicePaid from Payment) must be idempotent on the trigger's `proposalId` / `projectId` / `paymentId`. *Mitigation:* the aggregate factory functions check for existing derived state in the event stream; documented in §7 + AC-2/4/5.
- **R2 — Close-with-unpaid override.** Letting a `Project` close with unpaid invoices (with a reason) is a real human escape hatch. *Mitigation:* the reason is recorded as part of `ProjectClosed.payload.reason`; the audit trail preserves both the rule violation and the human justification.
- **R3 — Cross-aggregate replay cost.** Replaying to check invariants (delivered-project before invoice) means every invoice use case reads the event stream. v0 keeps the JSONL pattern; performance is not a constraint for this scale.
- **R4 — Spec creep into Project Management.** A `Project` aggregate could grow into tasks, milestones, or delivery proofs. *Mitigation:* non-goals §9 are binding; future extension is a separate spec.

---

## 11. Open questions

- **Q1 — Close-with-unpaid semantics.** Should the reason be free text or a tenant-defined enum? *Recommendation: free text for v0 (per Spec 001 Q3 alignment); taxonomy is a future tenant concern.*
- **Q2 — `InvoicePaid` for partial payments.** If a `PaymentReceived` amount < invoice amount, what happens? *Recommendation: v0 treats any applied payment as a transition to `paid` (matches Spec 001 "money-in is a hard fact" philosophy). Partial payments + credit notes are explicitly deferred (per Spec 001 Q4 territory).*
- **Q3 — `InvoiceOverdue` while already paid.** If a payment arrives while the invoice is `overdue`, do we emit both `InvoicePaid` and (somehow) a cleared signal? *Recommendation: a `paid` invoice carries no "overdue" state; the prior `InvoiceOverdue` remains in the trail for audit. The alert engine (Revenue Visibility) can detect the cleared condition.*

---

## 12. Out of scope for Phase 0 (what comes next, not now)

- Implementation is authorized by the accompanying `plan.md`.
- This spec does not authorize Tax & Compliance Guard, Administrative Shield, or any Phase 2+ engine.
- Future enhancements: partial payments, refunds, credit notes, multi-currency, scheduled overdue detection, delivery proofs.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and the existing [Event Catalog](../../docs/event-catalog.md). Closes the value chain as documented. Spec-first, conceptual only.*