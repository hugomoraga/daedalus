# Plan — Revenue Visibility v1 (implementation)

**Status:** Draft · implementation plan for [Spec 001](./spec.md), v1 (full slice)
**Goal:** Complete the Revenue Visibility module — the full revenue lifecycle, expenses, snapshots, and a financial summary with margin, runway, and basic state. Validate the alert pattern with tenant-injected thresholds.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.2.0
**Last updated:** 2026-06-14

> v0 (`@daedalus/revenue-visibility` v0) implemented only the cross-module composition: derive `RevenueEstimateCreated` from `ProposalGenerated` via `followFrom()`. This v1 completes the rest of Spec 001: `confirmed`/`received` lifecycle, expenses, snapshots, financial summary, and alerts.

---

## 0. Spec 001 open questions — resolutions for v1

The spec defers several questions that this v1 must answer before build:

- **Q2 (runway basis) — RESOLVED:** runway uses **received-only** revenue as "available balance". Conservative; the spec recommendation. Recorded in `FinancialSummary`.
- **Q3 (runway formula) — RESOLVED:** `runway_months = received_total / max(net_burn_per_month, 1)` where `net_burn = expenses / months_in_window` over the trailing period supplied by the tenant. The trailing period is a tenant parameter (default 3 months). One-off expenses are included (Simplicity First — separate them is a future enhancement).
- **Q1 (snapshots) — RESOLVED for v1:** manual-only. Scheduled snapshots require Phase 2 (Workflow Engine) and are out of scope.
- **Q4 (currency) — DEFERRED:** single tenant currency (already configured in `tenant-0.ts: "CLP"`).
- **Q5 (expected probability) — RESOLVED:** face value, no weighting. Simplicity First.
- **Q6 (Finance & Compliance context) — DELIBERATELY UNRESOLVED.** Per the spec, do not resolve now.

---

## 1. What we build

A v1 of `@daedalus/revenue-visibility` that adds to v0:

### Domain (lifecycle + value objects)
- `RevenueState = "expected" | "confirmed" | "received"` (extends v0's `"expected"`-only)
- `Estimate` aggregate with full lifecycle and terminal states
- `Expense` aggregate
- `Alert` value object + alert types
- `FinancialSummary` read-model type (expected, confirmed, received, expenses, margin, runwayMonths, basicState, activeAlerts)

### Module events (new)
- `RevenueEstimateUpdated` — explicit change of an estimate's amount/notes
- `RevenueConfirmed` — explicit transition to confirmed (manual), or derived from `ProposalApproved` (Core)
- `RevenueReceived` — explicit transition to received (manual), or derived from `PaymentReceived` (Core)
- `ExpenseRegistered` — founder records an expense
- `RevenueSnapshotGenerated` — founder takes a snapshot
- `FinancialRiskFlagged` — alert engine raises a risk

### Use cases
- `updateEstimateUseCase` — change an existing estimate's amount
- `confirmRevenueUseCase` — manual confirm an estimate (idempotent: skips if already confirmed/received)
- `receiveRevenueUseCase` — manual receive (idempotent: skips if already received)
- `registerExpenseUseCase` — record an expense (no event spam: single event per expense, no updates)
- `takeSnapshotUseCase` — capture a point-in-time financial summary as an event
- `evaluateAlertsUseCase` — given current summary + thresholds, emit any unsatisfied/raised alerts
- `projectFinancialSummary` — pure read-model: replays the event stream to compute the current summary

### Reactive ingest (extension of v0's `ingestProposalRevenueUseCase`)
- `revenue:ingest` now also reacts to:
  - `ProposalApproved` → emit `RevenueConfirmed` for any linked estimate (idempotent)
  - `PaymentReceived` → emit `RevenueReceived` for any linked estimate (idempotent)
- Same `followFrom()` pattern as v0, so the derived event shares the source's `correlationId`.

### Core additions (minimal, for cross-module consumption)
The catalog already lists `ProposalApproved` and `PaymentReceived` as Core events. v1 implements just the *minimum* needed for Revenue Visibility to react — **no new aggregates**, just the event types and an emitter use case that produces them manually (no upstream workflow):
- Add `ProposalApproved` and `PaymentReceived` to `value-chain.ts`
- Add minimal use cases: `approveProposalUseCase` (idempotent: rejects if already approved/rejected), `recordPaymentReceivedUseCase` (idempotent on `paymentId`).
- The Core remains the source of truth for these events; downstream modules (Revenue Visibility, future Tax & Compliance Guard) react to them.

> **Forward compatibility:** The `proposalId` on `RevenueConfirmed`/`RevenueReceived` lets the reactor correlate. When a future workflow (Phase 2) actually drives `ProposalApproved` from approval flow, Revenue Visibility will continue to work unchanged.

---

## 2. Architecture — hexagonal

```
packages/core/                                       # CHANGES: +2 events, +2 use cases
  src/domain/value-chain.ts                          #   + ProposalApproved, + PaymentReceived
  src/application/approve-proposal.ts                #   new use case
  src/application/record-payment.ts                  #   new use case
  src/index.ts                                       #   + exports

packages/revenue-visibility/                         # CHANGES: full v1
  src/domain/events.ts                               #   + all 6 new event constants
  src/domain/revenue.ts                              #   RevenueState extended
  src/domain/estimate.ts                             #   new: Estimate aggregate
  src/domain/expense.ts                              #   new: Expense aggregate
  src/domain/alert.ts                                #   new: Alert types + rule ids
  src/application/update-estimate.ts                 #   new
  src/application/confirm-revenue.ts                 #   new
  src/application/receive-revenue.ts                 #   new
  src/application/register-expense.ts                #   new
  src/application/take-snapshot.ts                   #   new
  src/application/evaluate-alerts.ts                 #   new
  src/application/projections.ts                     #   + projectFinancialSummary
  src/application/ingest-proposal-revenue.ts         #   + reactor for ProposalApproved/PaymentReceived
  src/application/ports/alert-thresholds.ts          #   new port: AlertThresholdsPort (tenant-injected)
  src/application/deps.ts                            #   RevenueDeps = CoreDeps & { thresholds }
  src/adapters/tenant-config-thresholds.ts           #   adapter: reads from config/tenants/
  src/adapters/index.ts                              #   barrel
  src/index.ts                                       #   expanded public contract

config/tenants/tenant-0.ts                           #   + alert thresholds (runway floor, concentration, period)
```

### Two ports in v1
- `EventStorePort` (existing) — the audit log
- `AlertThresholdsPort` (new) — tenant-injected thresholds. Same pattern as `DraftStorePort`/`OpportunityStorePort`: a port because the policy/values come from outside the Core, and using a port keeps the use case pure and the threshold source swappable (config now, future: policy engine).

### Lineage (the new patterns)
```
ProposalGenerated(correlationId=C, eventId=P)
   └─ v0 reactor → RevenueEstimateCreated(correlationId=C, causationId=P, state=expected)
                                                                          ↓ (manual update)
                                                                          → RevenueEstimateUpdated(correlationId=C, causationId=estimate, payload.amount)
                                                                          ↓ (manual confirm OR ProposalApproved reactor)
                                                                          → RevenueConfirmed(correlationId=C, causationId=…)
                                                                            ├─ if manual: causationId=lastEstimate.event
                                                                            └─ if reactive: follows from ProposalApproved via followFrom()
                                                                          ↓
                                                                          → RevenueReceived(... similar ...)

ExpenseRegistered(correlationId=C, payload.label, amount, occurredAt)   — separate flow, own correlation
RevenueSnapshotGenerated(correlationId=C, payload.summaryAtEventTime)  — separate flow, snapshot of current summary
FinancialRiskFlagged(correlationId=C, payload.ruleId, threshold, actualValue) — separate flow per alert
```

---

## 3. CLI commands (v1)

| Command | Use case | Emits / does |
|---|---|---|
| `revenue:ingest --tenant t0` | ingest-proposal-revenue (extended) | + reacts to `ProposalApproved`/`PaymentReceived` |
| `revenue:show --tenant t0` | (read) | expected revenue (kept for back-compat) |
| `revenue:summary --tenant t0` | (read) | full FinancialSummary (totals, margin, runway, state) |
| `revenue:update --tenant t0 --estimate <id> --amount <n>` | update-estimate | `RevenueEstimateUpdated` |
| `revenue:confirm --tenant t0 --estimate <id>` | confirm-revenue | `RevenueConfirmed` (manual) |
| `revenue:receive --tenant t0 --estimate <id>` | receive-revenue | `RevenueReceived` (manual) |
| `expense:register --tenant t0 --label <l> --amount <n>` | register-expense | `ExpenseRegistered` |
| `revenue:snapshot --tenant t0` | take-snapshot | `RevenueSnapshotGenerated` (carries current summary) |
| `revenue:alerts --tenant t0` | evaluate-alerts | prints alerts; emits `FinancialRiskFlagged` for newly raised ones |
| `proposal:approve --tenant t0 --proposal <id>` | approve-proposal (Core) | `ProposalApproved` (Core event) |
| `payment:record --tenant t0 --proposal <id> --amount <n>` | record-payment (Core) | `PaymentReceived` (Core event) |

> **Why CLI commands for Core events too:** the spec already says "manual in this phase" for approval/payment. The CLI keeps the driving-adapter discipline: it parses, dispatches, and renders — no business logic. The Core emits the event; downstream modules react.

---

## 4. Acceptance criteria → test mapping

| Spec 001 AC | v1 test |
|---|---|
| AC-1 (estimate from opportunity) | v0 + v1 (still works) |
| AC-2 (estimate from proposal) | v0 test, kept |
| AC-3 (lifecycle: expected → confirmed → received) | new: each transition + idempotency + double-counting guard |
| AC-4 (expense) | new |
| AC-5 (summary: totals, margin, runway, state) | new |
| AC-6 (alerts: low runway, concentration, negative cashflow) | new |
| AC-7 (snapshot) | new |
| AC-8 (auditability: lineage) | new (extends v0) |
| AC-9 (tenant isolation) | new |

Plus all v0 tests stay green. Plus Core additions get tests for `approve-proposal` and `record-payment`.

---

## 5. The evidence we capture

A scripted end-to-end session (synthetic data only) that exercises the full v1:

```
proposal:start t0 <leadId> standard         -> ProposalDraftCreated
proposal:add-item t0 <draftId> "Discovery" 1000
proposal:add-item t0 <draftId> "Build" 4000
proposal:finalize t0 <draftId>              -> ProposalGenerated(expectedValue=5000)
revenue:ingest t0                           -> RevenueEstimateCreated(state=expected)
revenue:summary t0                          -> expected=5000  confirmed=0  received=0  margin=-5000  runway=∞  state=watch
proposal:approve t0 <proposalId>            -> ProposalApproved
revenue:ingest t0                           -> RevenueConfirmed(state=confirmed, followFrom ProposalApproved)
payment:record t0 <proposalId> 5000         -> PaymentReceived
revenue:ingest t0                           -> RevenueReceived(state=received)
expense:register t0 "rent" 1000              -> ExpenseRegistered
expense:register t0 "software" 200           -> ExpenseRegistered
revenue:summary t0                          -> expected=0  confirmed=0  received=5000  margin=3800  runway=15.0  state=healthy
revenue:alerts t0                           -> no alerts (runway=15, no concentration, cashflow positive)
revenue:snapshot t0                         -> RevenueSnapshotGenerated
events t0                                   -> full audit trail with lineage (cross-module)
```

Two-tenant isolation: repeat the flow for `tenant-other`; each sees only its own.

---

## 6. Definition of done (v1)

- All Spec 001 acceptance criteria covered by `node --test`.
- v0 tests + new v1 tests all green.
- Re-running `revenue:ingest` is idempotent on every transition.
- Core events (`ProposalApproved`, `PaymentReceived`) emit exactly once per command.
- Alerts: emit once per condition until it clears (no spam).
- Snapshots: the snapshot event carries the current summary in its payload.
- State reconstructable by replaying the JSONL log; tenant isolation holds.
- CLI contains no business logic; domain knows nothing of JSONL.
- `.data/` gitignored; no PII.
- Q2/Q3 resolutions documented above (and reflected in code).

---

*Subordinate to [Spec 001](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md).*