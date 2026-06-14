# Tasks — Revenue Visibility

**Status:** v0 composition slice **shipped & green** · full module **blocked** (Q3)
**Derives from:** [Spec 001](./spec.md) + [Plan 001](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-13

> The `/tasks` step for Revenue Visibility. Tasks map to Spec 001 acceptance criteria. The v0 slice deliberately built **only** the cross-module composition (Plan 001 scope note); most of Spec 001's lifecycle is **intentionally deferred** and part of it is **blocked on open questions**.

---

## 1. Reality check (verified, not assumed)

The v0 composition slice **is built and passing** (`tests/revenue-visibility.test.ts` green: e.g. AC-RV-4 projection-by-replay, AC-RV-5 tenant isolation). `@daedalus/revenue-visibility` reacts to `ProposalGenerated`, emits a derived `RevenueEstimateCreated` (`expected`) via `followFrom()`, is idempotent, and exposes `projectExpectedRevenue`. The tasks below record that as **done** and scope what remains — most of which is **deliberately not built**.

---

## 2. v0 composition slice — DONE

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-01 | React to `ProposalGenerated`; emit derived `RevenueEstimateCreated` (`expected`) with `followFrom()` lineage | AC-2 | ✅ |
| T-02 | Idempotency: a `ProposalGenerated` whose `proposalId` already has an estimate is skipped (no double-count) | AC-3 (R1) | ✅ |
| T-03 | Read-model `projectExpectedRevenue(events)` — total + count, reconstructable by replay; viewing emits no event | AC-5, AC-8 | ✅ |
| T-04 | Tenant isolation of estimates | AC-9 | ✅ |
| T-05 | CLI wiring `revenue:ingest` as an explicit, replayable reactor (no event bus) | — | ✅ |

**This proves** the key validation goal: one module reacting cleanly to another's events over the shared substrate, with lineage preserved.

---

## 3. Deferred lifecycle — NOT STARTED

Spec 001 describes a full module (expected → confirmed → received, expenses, margin, runway, alerts, snapshot). The v0 slice built **none** of this beyond `expected`. These are real, specced, and unblocked **except where noted**.

| ID | Task | Spec AC | Depends on / Blocked by |
|---|---|---|---|
| T-06 | Manual `RevenueEstimateCreated` / `RevenueEstimateUpdated` (standalone items, no Core link) | AC-1 | none — buildable |
| T-07 | Lifecycle transitions `RevenueConfirmed` (manual or via Core `ProposalApproved`) / `RevenueReceived` (manual or via `PaymentReceived`), single-owner rule | AC-3 | needs Core `ProposalApproved` / `PaymentReceived` events to exist in the chain |
| T-08 | `ExpenseRegistered`; expenses reduce approximate margin | AC-4 | none — buildable |
| T-09 | Financial Summary read-model: expected/confirmed/received separated + approximate margin + basic state | AC-5 | T-07, T-08 |
| T-10 | Simple runway in the summary | AC-5 | **🚫 BLOCKED — Q3 (runway formula) blocks build; Q2 (runway basis) open** |
| T-11 | Alert rules: `low_runway`, `revenue_concentration`, `negative_cashflow` (emit-once-until-clear) | AC-6 | T-10 (low_runway); thresholds are Tenant-injected; Policy engine (Phase 3) for first-class rules |
| T-12 | `RevenueSnapshotGenerated` (immutable point-in-time freeze) | AC-7 | Q1 (manual vs scheduled — scheduling needs Workflow/Phase 2) |

---

## 4. Open decisions / blockers for a human

- **🚫 T-10 (runway) is blocked.** Spec 001 §12 marks **Q3 (runway formula)** as *"Blocks build"* and R6 warns a wrong formula gives dangerously wrong signals. **Do not implement runway until Q3 is resolved** and Q2 (received-only vs confirmed+received) is decided. This is the single hardest gate in the module.
- **R2 — false precision** and **R3 — alert fatigue** are flagged edge cases for human review before alerts ship.
- **Q6 (future Finance & Compliance Core context)** is deliberately deferred — do not resolve while building these tasks.
- **No tax, no bank/SII integration, no multi-currency, no double-entry** — binding non-goals (Spec 001 §10). Such needs spawn new specs.

---

*Subordinate to [Spec 001](./spec.md) and [Plan 001](./plan.md). Tasks only — the composition slice is shipped; the lifecycle is deferred and runway is blocked on Q3.*
