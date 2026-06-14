# Daedalus Event Catalog

**Status:** Foundational · Phase 0 (conceptual only)
**Version:** 0.2.0
**Last updated:** 2026-06-13

> **Why this document exists.** By constitution, *Everything is an Event* and *Auditability by Default*. Events are not an implementation detail — they are the organizational ground truth. Current state is a projection of the event stream; the [Audit Log](./domain-model.md#audit-log) is its durable record. This catalog is the canonical vocabulary of *what can happen* in the initial value chain.
>
> **Semantic note after the platform refactor (v0.2.0).** The value-chain events below are **Core, tenant-agnostic, and tenant-scoped**: `LeadCreated` means the same thing for any tenant, and every event instance belongs to exactly one tenant (the tenant is part of its lineage). [Tenant 0](../blueprints/tenants/tenant-0-founder-profile.md) is the first emitter of these events, but nothing about the founder is encoded in the vocabulary. **Module-derived events** (§2.5) arise from the initial modules; they are reusable and parameterized by tenant, never founder-specific.
>
> **Method.** Events were discovered via **Event Storming** (Brandolini): we walked the value chain backwards from the outcome (Payment) and named every state change a domain expert would recognize. We keep only **domain events** that carry organizational meaning — not technical events (a record was written, a cache was cleared). The test for inclusion: *would a human steward want this in the audit trail?*

---

## Conventions

- **Naming:** `Subject` + past-tense verb (`LeadCreated`, `InvoicePaid`). Past tense because an event records something that *already happened* and is immutable.
- **Immutability:** events are append-only. A mistake is corrected by a *new* compensating event, never by editing or deleting one.
- **Lineage:** every event carries (conceptually) — the **tenant** it belongs to, the **actor** that caused it (human or agent identity), the **cause** (triggering event or instruction), and the **authorizing policy** where the action was governed. This is what makes auditability structural.
- **Scope discipline:** this catalog covers *only* the initial value chain plus the minimum governance events. New events are added by specification, not improvisation.

---

## 1. Value-Chain Events

The core narrative: a lead becomes money in the bank.

| Event | Emitted when | Rationale (why it earns a place in the audit trail) |
|---|---|---|
| `LeadCreated` | A potential engagement enters the system. | The origin of the value chain. Without it there is no traceable start to "where did this revenue come from." |
| `LeadQualified` | A lead is judged worth pursuing. | Records a *decision* (governed by policy/human) to invest effort. Separates raw interest from committed pipeline. |
| `LeadDiscarded` | A lead is dropped. | Negative outcomes matter as much as positive ones. Auditing *why we said no* prevents silent loss and reveals qualification quality. |
| `ProposalGenerated` | A formal offer is produced from a qualified lead. | The transition from internal intent to an external commitment-in-waiting. First artifact a customer sees. |
| `ProposalSubmitted` | The proposal is sent to the customer. | Marks the boundary between internal drafting and external exposure — a different accountability regime begins here. |
| `ProposalApproved` | The proposal is accepted (the **approval gate**). | A pivotal governed decision. Triggers Project creation. Frequently human-governed per Constitution Article V. |
| `ProposalRejected` | The proposal is declined. | Closes the branch with a reason. Essential for win/loss analysis and for proving the chain ended legitimately. |
| `ProjectCreated` | An approved proposal becomes committed work. | The organization now owes delivery. Marks the start of obligation and the handoff between Commercial and Delivery contexts. |
| `ProjectDelivered` | The committed work is completed. | The "Delivery" step of the value chain. Pre-condition for legitimate invoicing — you should not bill for undelivered work. |
| `ProjectClosed` | The project is formally concluded. | Distinguishes "work done" from "engagement closed" (e.g. after billing settles). Bookend of the engagement lifecycle. |
| `InvoiceIssued` | A demand for payment is created. | Creates a financial claim. Must be traceable to a delivered project — the anti-fraud / anti-error anchor of billing. |
| `InvoiceSent` | The invoice is delivered to the customer. | Starts payment-term clocks and external accountability. Distinct from issuing it internally. |
| `InvoicePaid` | Payment is received and applied. | The value chain's success condition. Closes the loop opened by `LeadCreated`. |
| `InvoiceOverdue` | Payment terms lapse without settlement. | A risk signal. Auditable so dunning/collections actions are themselves governed and traceable. |
| `PaymentReceived` | Funds are received against an invoice. | The irreversible financial fact. Distinct from `InvoicePaid` (which is the *application* of a payment to an invoice) to keep money-movement and accounting-status separable. |

> **Design note — why `PaymentReceived` and `InvoicePaid` are separate.** Receiving money and marking an invoice settled are two facts that can diverge (partial payment, payment to the wrong invoice, overpayment). Keeping them as distinct events preserves truth even when reconciliation is messy. This is a deliberate cost paid against *Simplicity First* because the alternative loses auditability of money movement — a poor trade for a system whose whole point is auditability.

---

## 2. Governance Events

Events emitted by the cross-cutting Governance context. These make the *rules and their enforcement* auditable, not just the business outcomes.

| Event | Emitted when | Rationale |
|---|---|---|
| `PolicyDefined` | A new policy is ratified. | Policy is first-class and versioned. The audit trail must show *which rules were in force when*. |
| `PolicyAmended` | An existing policy changes. | Behavior can only be explained if you know which policy version governed an action. |
| `PolicyEvaluated` | A policy renders a decision (allow/deny) on a proposed action. | The heart of "Policy before Agent." Every governed action should be explainable by a recorded policy decision. |
| `ActionDenied` | A policy or the default-deny rule blocks an action. | Denials are as important as approvals. Proves the guardrails actually fired. |
| `EscalationRaised` | The system hands a decision to a human (policy gap, irreversibility, ambiguity). | Operationalizes Human Governance. Records exactly where automation stopped and judgment took over. |
| `HumanDecisionRecorded` | A human resolves an escalation or approves a gate. | Anchors accountability to a named person, satisfying Constitution Article V. |
| `AgentActionExecuted` | An agent completes an authorized task. | Every agent action must be a traceable event (Article IV). No silent agent activity. |
| `WorkflowStarted` / `WorkflowCompleted` | A workflow instance begins / ends. | Bookends an orchestration so the path through the value chain is reconstructable end to end. |
| `ConstitutionAmended` | The constitution is formally amended. | The highest-order governance event. Required by Constitution Article VI. |

---

## 2.5 Module-Derived Events (reusable, tenant-parameterized)

These events arise from the initial **modules**. They are born from Tenant 0's pain but defined generically — any tenant adopting the module emits them. They are listed for completeness and to keep the vocabulary coherent; **none are in scope before the phase that activates their module** (see [Roadmap](./roadmap.md)). Marked `[deferred]`.

| Event | Module | Emitted when | Rationale |
|---|---|---|---|
| `OpportunitySurfaced` **(implemented, v0)** | Opportunity Discovery | A potential engagement is recorded. | The origin of a pipeline entry; a deliberate human input. See [Spec 003 plan](../specs/003-opportunity-discovery/plan.md). |
| `OpportunityEnriched` **(implemented, v0)** | Opportunity Discovery | A surfaced opportunity's context (description, contact) is updated. | Records what was known at decision time for audit quality. |
| `OpportunityQualified` **(implemented, v0)** | Opportunity Discovery | An opportunity is qualified and handed off to the pipeline as a Lead. | A commitment decision — creates a Lead and closes the opportunity for further editing. |
| `OpportunityDismissed` **(implemented, v0)** | Opportunity Discovery | An opportunity is deliberately dropped with a reason. | Records *why not* — protects focus and enables pipeline quality analysis. |
| `RevenueEstimateCreated` **(implemented, v0)** | Revenue Visibility | An expected-revenue item is recorded. **v0:** derived from a `ProposalGenerated` via `followFrom()` (carries `sourceProposalId`, shares the proposal's `correlationId`). Manual entry deferred. | The origin of an expectation; first cross-module derived event. See [Spec 001 plan](../specs/001-revenue-visibility/plan.md). |
| `RevenueEstimateUpdated` `[deferred]` | Revenue Visibility | An estimate changes. | The change of a forecast must be traceable. |
| `RevenueConfirmed` `[deferred]` | Revenue Visibility | Revenue moves to `confirmed` (manually or via Core `ProposalApproved`). | A commitment decision that materially changes the picture. |
| `RevenueReceived` `[deferred]` | Revenue Visibility | Revenue moves to `received` (manually or via Core `PaymentReceived`). | Money-in is a hard fact. |
| `ExpenseRegistered` `[deferred]` | Revenue Visibility | A founder registers an expense. | A deliberate input affecting margin and runway. |
| `RevenueSnapshotGenerated` `[deferred]` | Revenue Visibility | A point-in-time financial snapshot is explicitly taken. | A deliberate act freezing a value the founder may rely on. |
| ~~`RevenueProjectionUpdated`~~ **(retired)** | Revenue Visibility | — | **Decision (Spec 001):** the live revenue projection is a **read-model**, not an event. It recomputes silently; only auditable facts/decisions above earn events. |
| `TaxObligationDetected` `[deferred]` | Tax & Compliance Guard | An obligation becomes relevant (parameterized by the tenant's jurisdiction). | Turns dread into a traceable, governed signal. Cannot be defined until jurisdiction is set in the tenant profile. |
| `ComplianceRiskFlagged` `[deferred]` | Tax & Compliance Guard | A deadline approaches or a rule is at risk of breach. | A governed risk signal that escalates to the human before damage — operationalizes Human Governance for compliance. |
| `AdministrativeTaskAbsorbed` `[deferred]` | Administrative Shield | An administrative task is handled by the system (or queued as a decision for the founder) rather than reaching them as a chore. | Directly records attention returned to the founder — the system's core value, made measurable. |

> **Why these are separated from Core events.** Per Principle 10, module events must not pollute the Core vocabulary. A tenant that does not adopt Tax & Compliance Guard never emits `TaxObligationDetected`. Keeping them in their own section makes the Core's tenant-agnostic core vocabulary legible on its own.

---

## 3. The Happy Path, as Events

How the events chain through one successful engagement:

```
LeadCreated
  → LeadQualified                (PolicyEvaluated: qualification rules)
    → ProposalGenerated
      → ProposalSubmitted
        → ProposalApproved        (EscalationRaised → HumanDecisionRecorded, if human-governed)
          → ProjectCreated         (WorkflowStarted: delivery)
            → ProjectDelivered
              → InvoiceIssued      (PolicyEvaluated: "deliver before bill")
                → InvoiceSent
                  → PaymentReceived
                    → InvoicePaid
                      → ProjectClosed   (WorkflowCompleted)
```

Each arrow is a reaction, not a direct call: one context emits an event, another reacts. That decoupling is what lets the organization evolve module by module without rewiring the core.

---

## 4. Out of Scope (for now)

Deliberately excluded under *Simplicity First*; candidates for future specs:
- Partial payments, refunds, credit notes (`PaymentRefunded`, `CreditNoteIssued`).
- Multi-milestone delivery (`MilestoneDelivered`).
- Lead nurturing / campaign events.
- Customer lifecycle events beyond the value chain.
- Agent capability lifecycle (`AgentCapabilityGranted`, `AgentCapabilityRevoked`).

> **Edge cases flagged for human review:**
> - **`ProjectDelivered` vs. partial delivery.** The current chain assumes a project is delivered atomically. Milestone-based delivery + billing would need `MilestoneDelivered` and would break the `Invoice ── Project` 1:N assumption. Confirm atomic delivery is acceptable for the first iteration.
> - **Compensating events.** We assert "correct by new event, never edit." We have *not* yet defined the compensating events (e.g. `InvoiceCancelled`, `ProjectReopened`). Flagging that error-correction semantics need a dedicated spec before Phase 2 (Workflow Engine), since rollback is a workflow concern.
> - **`TaxObligationDetected` is blocked on jurisdiction.** The tax/compliance events cannot be specified until the Tenant 0 profile sets a jurisdiction. This is the first hard blocker for any tax-related module spec.
> - **~~`RevenueProjectionUpdated`~~ — RESOLVED (Spec 001).** Decided to keep the live projection as a read-model with no event, and to emit events only for auditable facts/decisions (estimates, confirmations, receipts, expenses, snapshots, risk flags). The risk of log noise drove the decision.

---

*Subordinate to the [Constitution](../memory/constitution.md). Pairs with the [Domain Model](./domain-model.md) — events are the verbs, aggregates are the nouns.*
