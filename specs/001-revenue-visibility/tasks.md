# Tasks — Revenue Visibility

**Status:** v0 composition slice **shipped & green** · v1 lifecycle **shipped & green** (PR #13 — `011-revenue-visibility-v1`, merged `ead20b9`)
**Derives from:** [Spec 001](./spec.md) + [Plan 001](./plan.md) (v0.2.0, full slice)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.3.0
**Last updated:** 2026-06-15

> The `/tasks` step for Revenue Visibility. Tasks map to Spec 001 acceptance criteria. **Both v0 and v1 are shipped.** No task currently pending within Spec 001 scope; the remaining items in this file are forward-planning, not a build authorization.

---

## 1. Reality check (verified, not assumed)

- v0: `@daedalus/revenue-visibility` reacts to `ProposalGenerated`, emits `RevenueEstimateCreated` (`expected`) via `followFrom()`, idempotent, `projectExpectedRevenue` works. T-01..T-05 are done and green.
- v1: full Spec 001 slice is shipped — confirmed/received lifecycle, expenses, snapshots, financial summary, and alerts. T-06..T-16 are done and green (`tests/revenue-visibility-v1.test.ts`).

---

## 2. v0 composition slice — DONE

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-01 | React to `ProposalGenerated`; emit derived `RevenueEstimateCreated` (`expected`) with `followFrom()` lineage | AC-2 | ✅ |
| T-02 | Idempotency: a `ProposalGenerated` whose `proposalId` already has an estimate is skipped (no double-count) | AC-3 (R1) | ✅ |
| T-03 | Read-model `projectExpectedRevenue(events)` — total + count, reconstructable by replay; viewing emits no event | AC-5, AC-8 | ✅ |
| T-04 | Tenant isolation of estimates | AC-9 | ✅ |
| T-05 | CLI wiring `revenue:ingest` as an explicit, replayable reactor (no event bus) | — | ✅ |

---

## 3. v1 full slice — DONE

Spec 001's full module: expected → confirmed → received lifecycle, expenses, financial summary, alerts, snapshots. Shipped in PR #13.

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-06 | Manual revenue: standalone `RevenueEstimateCreated` (no Core link) + `RevenueEstimateUpdated` | AC-1 | ✅ |
| T-07 | Lifecycle: `RevenueConfirmed` (manual) + reactor from Core `ProposalApproved`; `RevenueReceived` (manual) + reactor from Core `PaymentReceived`. Single-owner rule (no double-count) | AC-3, R1 | ✅ |
| T-08 | `ExpenseRegistered`; expenses reduce margin and runway | AC-4 | ✅ |
| T-09 | `FinancialSummary` projection: expected/confirmed/received separated + margin + basic state | AC-5 | ✅ |
| T-10 | Simple runway: `runway_months = received_total / max(expenses_per_month, 1)` over trailing period (Q3 resolved) | AC-5 | ✅ |
| T-11 | Alert rules: `low_runway`, `revenue_concentration`, `negative_cashflow` (emit-once-until-clear, thresholds tenant-injected) | AC-6 | ✅ |
| T-12 | `RevenueSnapshotGenerated` (manual snapshot carrying current summary in payload) | AC-7 | ✅ |
| T-13 | **Core additions (required for T-07):** add `ProposalApproved` + `PaymentReceived` event types and minimal use cases (`approve-proposal`, `record-payment`) | — | ✅ |
| T-14 | AlertThresholdsPort + TenantConfigThresholdsAdapter (tenant injects thresholds via `config/tenants/`) | — | ✅ |
| T-15 | CLI v1 commands: `revenue:update`, `revenue:confirm`, `revenue:receive`, `revenue:summary`, `revenue:snapshot`, `revenue:alerts`, `expense:register`, `proposal:approve`, `payment:record` | — | ✅ |
| T-16 | Tests: AC-1..AC-9 of Spec 001 + Core additions (replay reconstruction, no double-count, alerts emit-once-until-clear) | AC-1..AC-9 | ✅ |

### v1 evidence run (executed)

A scripted end-to-end session (synthetic data only) — full v1 lifecycle:
1. finalize a proposal → `ProposalGenerated(expectedValue=5000)`
2. `revenue:ingest` → `RevenueEstimateCreated(state=expected)`
3. `revenue:summary` → expected=5000, margin=-5000, state=watch
4. `proposal:approve` → `ProposalApproved` (Core)
5. `revenue:ingest` → `RevenueConfirmed` (follows from ProposalApproved)
6. `payment:record` → `PaymentReceived` (Core)
7. `revenue:ingest` → `RevenueReceived` (follows from PaymentReceived)
8. register expenses → `ExpenseRegistered`
9. `revenue:summary` → received=5000, margin=3800, runway=15.0, state=healthy
10. `revenue:alerts` → no alerts (all thresholds satisfied)
11. `revenue:snapshot` → `RevenueSnapshotGenerated`
12. `events` → full audit trail with lineage across all three modules

Plus two-tenant isolation test (already in v0, repeated for v1 commands).

---

## 4. Q2/Q3 resolutions (carried from Plan 001 v0.2.0 §0)

- **Q2 (runway basis):** `received` only — conservative. Recorded in `FinancialSummary`.
- **Q3 (runway formula):** `runway_months = received_total / max(expenses_per_month, 1)` where `expenses_per_month = total_expenses / trailing_period_months` (tenant parameter, default 3). One-off expenses included (Simplicity First).
- **Q1 (snapshots):** manual-only in v1; scheduled snapshots require Phase 2 (Workflow Engine).
- **Q4 (currency):** single tenant currency (already configured in `tenant-0.ts: "CLP"`).
- **Q5 (probability weighting):** face value, no weighting.
- **Q6 (future Finance & Compliance context):** deliberately unresolved.

---

## 5. Open decisions / blockers for a human

- **R2 (false precision) and R3 (alert fatigue)** are flagged for human review before alerts ship. The implementation includes the "emit-once-until-clear" mitigation per AC-6, but the founder (Tenant 0) should review thresholds before declaring alerts authoritative.
- **Q6** stays deliberately unresolved per the spec.
- **No tax, no bank/SII integration, no multi-currency, no double-entry** — binding non-goals.

---

*Subordinate to [Spec 001](./spec.md) and [Plan 001](./plan.md). v0 is shipped; v1 is the next authorized build.*