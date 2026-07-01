# Spec 001 — Revenue Visibility (Module)

**Status:** Ratified · **v0+v1 SHIPPED** (full slice — PR #13 `011-revenue-visibility-v1`, T-01..T-16 ✅, `tests/revenue-visibility-v1.test.ts` green; spec body §12 Q1–Q5 closed in Plan 001 §0, Q6 deliberately unresolved)
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Version:** 1.0.0
**Last updated:** 2026-07-01

> **Method.** Spec-first (Constitution, Principle 8). This document defines *what* Revenue Visibility must do and *why*, not *how*. No code, no API, no database schema, no UI, no bank/tax/SII integration, no real data. Conceptual domain language only.

---

## 1. Summary

Revenue Visibility is the first formal Daedalus module. It lets a founder/tenant see, simply and auditably:

- **expected** revenue (estimates not yet committed),
- **confirmed** revenue (committed but not yet received),
- **received** revenue (money in),
- **registered expenses**,
- an **approximate margin**,
- a **simple runway**,
- a **basic financial state**, and
- **early-warning signals** (low runway, revenue concentration, expenses above income).

It is chosen as Spec 001 because it delivers value to Tenant 0 early, has **low legal/tax dependency**, and lets us validate the **Core → Module → Tenant** composition before touching Tax & Compliance.

> **What this module is NOT** (binding): it is **not official accounting**, it does **not compute definitive taxes**, it does **not replace an accountant**, and it does **not handle real banking data** in this phase. It is a *visibility* tool — a trustworthy, auditable picture for decision-making, not a system of record for compliance.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates to it |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key ones: *Everything is an Event* (financial **facts and decisions** are events; the live projection is a read-model — §6); *Auditability by Default* (every relevant change is traceable); *Policy before Agent* (alert rules are policy-shaped, not agent improvisation); *Generic Core, Specific Tenants* (this is a Module, not Core — §4); *Simplicity First* (visibility only, no accounting). |
| **[Identity](../../docs/identity.md)** | Passes the litmus test (§6 there): financial visibility is *a reusable solution to a class of pain* → a **Module**, not Core, not a Tenant specific. Serves the founder's goal of returning attention; optimizes for **traceability and sustainability**, not growth. |
| **[Tenant 0 Profile](../../blueprints/tenants/tenant-0-founder-profile.md)** | Realizes the **"basic accounting"** pain (Pain #2). Tenant 0 supplies the data, currency, and alert thresholds; the module supplies the generic logic. |
| **[Domain Model](../../docs/domain-model.md)** | Consumes Core events from Commercial and Delivery & Billing; adds no new Core bounded context (per the ratified decision to *not* create Finance & Compliance in Core yet). |
| **[Event Catalog](../../docs/event-catalog.md)** | Replaces the placeholder `RevenueProjectionUpdated` with the concrete module event set defined in §6. |

---

## 3. Goals

1. Give the founder a **single, trustworthy financial picture** without manual bookkeeping.
2. Make the picture **auditable**: every relevant change traceable to who/what/when.
3. Surface **early-warning signals** before they become problems.
4. Work from **manual or mock, tenant-scoped data** in this phase (no integrations).
5. **Validate the Core → Module → Tenant model** end to end on a low-risk capability.

---

## 4. Core / Module / Tenant split

This is the central architectural validation of the spec. Each concern is placed in exactly one layer.

### Lives in the **Core** (generic, tenant-agnostic — reused, not defined here)
- The **event substrate**: append-only Audit Log, event emission, lineage (tenant, actor, cause, policy).
- **Tenant isolation** (all data and events scoped to one tenant).
- The **read-model / projection mechanism** (generic ability to derive a view from an event stream).
- Existing Core events this module *consumes*: `ProposalApproved`, `InvoiceIssued`, `PaymentReceived` (from the value chain).
- The **policy engine** that will evaluate alert rules (when Phase 3 exists; until then, rules are declared but evaluated simply).

### Lives in the **Module** (Revenue Visibility — reusable, defined here)
- The financial **domain concepts**: Revenue Item, Expense, Financial Summary (read-model), Alert (§5).
- The **revenue lifecycle**: expected → confirmed → received.
- The **module events** (§6) for manually-entered financial facts and decisions.
- The **projection logic** that turns events (module + consumed Core) into the Financial Summary read-model.
- The **alert rule definitions** (generic logic, thresholds injected by tenant): low runway, revenue concentration, expenses-above-income.
- The **snapshot** concept (a deliberate, point-in-time materialization).

### Lives in the **Tenant** (Tenant 0 — specific, NOT here)
- Actual **data**: estimates, expenses, amounts, source labels.
- **Currency** and any locale assumptions.
- **Alert thresholds**: runway floor (e.g. months of runway), concentration ceiling (e.g. % from one source), the period for cashflow comparison.
- The **decision to enable** the module.

> **Anti-overfitting rule (Principle 10):** if this module ever needs a founder-specific behavior, that parameter goes into the Tenant 0 profile, never hard-coded into the module. A second tenant must be able to adopt Revenue Visibility unchanged.

---

## 5. Domain concepts (conceptual — no schema)

- **Revenue Item** — a unit of potential or actual income. Conceptually carries: a human label, an estimated/expected amount, a **state** (`expected` | `confirmed` | `received`), and an optional **link** to a Core source (a Lead, Proposal, or Payment). Standalone items (manual, no Core link) are allowed in this phase.
- **Expense** — a unit of registered cost. Conceptually carries: a label, an amount, and a date/period. Simple and flat in this phase (no categories, no allocation).
- **Financial Summary** — the **read-model**: a derived, always-current view (expected/confirmed/received totals, approximate margin, simple runway, basic state, active alerts). It is **computed**, not stored as truth, and **emits no event when it recomputes** (see §6).
- **Snapshot** — a deliberate, point-in-time freeze of the Financial Summary, taken by an explicit act (founder or scheduled). Unlike the live summary, taking a snapshot **is** an auditable event.
- **Alert** — a derived signal that a risk rule has triggered. Raising an alert **is** an event (it may escalate to a human per Human Governance).

### Derived measures (conceptual definitions — confirm in Open Questions)
- **Approximate margin** = received (or confirmed) revenue − registered expenses, over a period. Labeled *approximate* deliberately — it is not accounting-grade.
- **Simple runway** = current available balance ÷ average net burn per period. "Available balance" and "net burn" need a tenant-confirmed definition (Open Question Q3).
- **Basic financial state** = a coarse status (e.g. `healthy` / `watch` / `at-risk`) derived from runway + active alerts. Thresholds are tenant-configured.

---

## 6. Events vs. read-model (resolves the `RevenueProjectionUpdated` question)

**Decision:** the live revenue projection is a **read-model**, NOT an event. It recomputes continuously from the event stream and emits nothing on recompute. An event is emitted **only** when there is an auditable *fact* or *human decision* — consistent with the Event Catalog's inclusion test ("would a human steward want this in the audit trail?") and with the stated preference.

This retires the placeholder `RevenueProjectionUpdated` from the [Event Catalog](../../docs/event-catalog.md).

### Module events (auditable facts & decisions)

| Event | Emitted when | Why it earns an event (not just a read-model change) |
|---|---|---|
| `RevenueEstimateCreated` | A founder records an estimated/expected revenue item. | A deliberate human input; the origin of an expectation. |
| `RevenueEstimateUpdated` | An estimate's amount or details change. | The *change* of an expectation must be traceable (avoids silent revision of forecasts). |
| `RevenueConfirmed` | A revenue item moves to `confirmed` (manually, or derived from a Core `ProposalApproved`). | A commitment decision — materially changes the financial picture. |
| `RevenueReceived` | A revenue item moves to `received` (manually, or derived from a Core `PaymentReceived`). | Money-in is a hard fact; the success signal of the chain. |
| `ExpenseRegistered` | A founder records an expense. | A deliberate human input affecting margin and runway. |
| `RevenueSnapshotGenerated` | A point-in-time snapshot of the summary is explicitly taken. | A deliberate act; freezes a value the founder may rely on for a decision. **This** is why snapshots are events while the live projection is not. |
| `FinancialRiskFlagged` | An alert rule triggers. | A governed risk signal that may escalate to a human (Human Governance). |

> **Double-counting hazard (flagged, see Risks R1).** When a revenue item is linked to a Core source, its state transition may be driven by a Core event (`ProposalApproved` → confirmed, `PaymentReceived` → received). The module must treat the Core event as the trigger and **not** double-count a manually-marked transition for the same item. Standalone (Core-unlinked) items transition only via module events.

---

## 7. User stories

> Format: *As a [role], I want [capability], so that [outcome].*

- **US-1 — Record an opportunity's value.** As a founder, I want to record an opportunity with an estimated value, so that potential income is visible before it is committed.
- **US-2 — Record a proposal's expected value.** As a founder, I want a proposal to carry an expected revenue value, so that my pipeline reflects realistic expectations.
- **US-3 — Track revenue lifecycle.** As a founder, I want to mark revenue as `expected`, `confirmed`, or `received`, so that I can distinguish hopeful from real money.
- **US-4 — Register an expense.** As a founder, I want to register a simple expense, so that my margin and runway reflect costs.
- **US-5 — See a financial summary.** As a founder, I want a simple financial summary (expected/confirmed/received, approximate margin, simple runway, basic state), so that I understand my situation at a glance without bookkeeping.
- **US-6 — Get early-warning alerts.** As a founder, I want alerts for low runway, revenue concentration, and expenses exceeding income, so that I can act before a problem becomes a crisis.
- **US-7 — Take a snapshot.** As a founder, I want to take a point-in-time financial snapshot, so that I have an auditable record of my position at a moment I cared about.
- **US-8 — Audit changes.** As a founder (or a steward), I want every relevant financial change to be traceable, so that I can trust and reconstruct how the picture was formed.

---

## 8. Acceptance criteria

> Format: Given / When / Then. Each criterion ties to a story.

**AC-1 (US-1):**
- *Given* an opportunity with an estimated value, *when* the founder records it, *then* a `RevenueEstimateCreated` event is emitted (tenant-scoped, with lineage) and the item appears in the summary as `expected`.

**AC-2 (US-2):**
- *Given* a Core Proposal, *when* it carries an expected revenue value, *then* an associated `expected` revenue item is reflected in the summary and linked to that Proposal.

**AC-3 (US-3 — lifecycle):**
- *Given* an `expected` revenue item, *when* it is confirmed (manually or via Core `ProposalApproved`), *then* `RevenueConfirmed` is recorded and the item counts as `confirmed`, no longer `expected`.
- *Given* a `confirmed` item, *when* it is received (manually or via Core `PaymentReceived`), *then* `RevenueReceived` is recorded and it counts as `received`.
- *Given* a Core-linked item, *when* the Core event drives the transition, *then* the module does **not** double-count a separate manual transition for the same item (R1).

**AC-4 (US-4):**
- *Given* a cost, *when* the founder registers it, *then* `ExpenseRegistered` is emitted and the expense reduces the approximate margin and runway.

**AC-5 (US-5 — summary):**
- *Given* recorded items and expenses, *when* the founder views the summary, *then* it shows expected, confirmed, and received totals **separately**, an approximate margin, a simple runway, and a basic state — all derived from the event stream, with no event emitted by the act of viewing.

**AC-6 (US-6 — alerts):**
- *Given* runway below the tenant's configured floor, *when* the summary recomputes, *then* a `FinancialRiskFlagged` (type `low_runway`) is emitted once until the condition clears (no alert spam).
- *Given* a single source exceeding the tenant's concentration ceiling of confirmed+received revenue, *then* a `FinancialRiskFlagged` (type `revenue_concentration`) is emitted.
- *Given* registered expenses exceeding confirmed+received revenue over the tenant's configured period, *then* a `FinancialRiskFlagged` (type `negative_cashflow`) is emitted.

**AC-7 (US-7 — snapshot):**
- *Given* a current summary, *when* the founder takes a snapshot, *then* `RevenueSnapshotGenerated` is emitted and the snapshot's values are immutable thereafter.

**AC-8 (US-8 — auditability):**
- *Given* any module event, *when* it is emitted, *then* it carries tenant, actor, cause, and (where governed) authorizing policy, and is appended to the Audit Log immutably.
- *Given* the event stream, *when* replayed, *then* the current summary is fully reconstructable (the read-model holds no truth the events don't).

**AC-9 (isolation):**
- *Given* two tenants, *when* either views its summary, *then* it reflects only that tenant's data; no cross-tenant leakage is possible.

---

## 9. Alert rules (declarative, thresholds tenant-injected)

| Rule | Triggers when | Threshold owner | Severity intent |
|---|---|---|---|
| **Low runway** | simple runway < runway floor | Tenant | high — existential |
| **Revenue concentration** | one source > concentration ceiling of confirmed+received | Tenant | medium — fragility |
| **Negative cashflow** | expenses > confirmed+received revenue over period | Tenant | high — solvency |

Rule **logic** is generic (Module). Rule **thresholds** are tenant-configured (Tenant). Until the Policy Engine (Phase 3) exists, rules are evaluated simply and directly; they are written so they can later be expressed as first-class policy without redesign.

---

## 10. Non-goals (binding)

- **Not** official/statutory accounting or a system of record for compliance.
- **Not** definitive tax calculation (no VAT/IVA, no income tax, no withholdings).
- **No** SII or any tax-authority integration.
- **No** bank or payment-processor integration; no real banking data.
- **No** full double-entry bookkeeping, chart of accounts, or ledgers.
- **No** real invoicing (invoices remain a Core concept consumed as events; this module does not issue them).
- **No** multi-currency math in this phase (single tenant currency assumed — Q4).
- **No** UI, API, schema, or code in this spec (spec-first).
- **Not** a replacement for an accountant; outputs are *indicative*, labeled *approximate*.

---

## 11. Risks

- **R1 — Double-counting revenue.** Items linked to Core sources could be counted both by the Core event and a manual module event. *Mitigation:* a single owner of each transition (Core event wins for linked items); explicit rule in §6 and AC-3.
- **R2 — False precision.** A clean number invites the founder to trust it as accounting-grade. *Mitigation:* label everything *approximate*; non-goals state plainly it is not accounting. **Edge case for human review.**
- **R3 — Alert fatigue.** Noisy alerts get ignored, defeating the purpose. *Mitigation:* emit once per condition until it clears (AC-6); tenant-tunable thresholds.
- **R4 — Module/Core boundary creep.** Pressure to add "just a little tax" or "just a bank sync" would violate the ratified scope and Principle 10. *Mitigation:* non-goals are binding; such needs spawn new specs/modules.
- **R5 — Manual data drift.** With manual/mock data, the picture is only as good as what the founder enters. *Mitigation:* accepted limitation for this phase; documented; integrations are a future spec.
- **R6 — Runway definition ambiguity.** A wrong runway formula gives dangerously wrong signals. *Mitigation:* runway definition is an Open Question (Q3) to be resolved before build.

---

## 12. Open questions

> **Status (2026-07-01):** all questions resolved in [Plan 001 §0](./plan.md#0-spec-001-open-questions--resolutions-for-v1) during v1 build (PR #13, merged 2026-06-22). Q6 deliberately unresolved per the spec.

- **Q1 — Snapshot trigger.** **Resolved (Plan 001 §0):** manual-only in v1; scheduled snapshots require Phase 2 (Workflow Engine) and are out of scope for Spec 001.
- **Q2 — Confirmed vs. received as the runway basis.** **Resolved (Plan 001 §0):** runway uses **received-only** revenue as "available balance" (conservative; spec recommendation). Recorded in `FinancialSummary`.
- **Q3 — Runway formula.** **Resolved (Plan 001 §0):** `runway_months = received_total / max(net_burn_per_month, 1)` where `net_burn = expenses / months_in_window` over the trailing period supplied by the tenant (default 3 months). One-off expenses included (Simplicity First). No longer blocks build.
- **Q4 — Currency.** **Resolved (Plan 001 §0):** single tenant currency, currently configured as `"CLP"` in `config/tenants/tenant-0.ts`. Multi-currency, if ever needed, is a future spec (not Spec 001).
- **Q5 — Expected-revenue probability.** **Resolved (Plan 001 §0):** face value, no weighting. Simplicity First. Weighting is a future enhancement.
- **Q6 — Where does this sit relative to a future Finance & Compliance context?** **Deliberately unresolved.** Per the spec, do not resolve now. The Tax & Compliance Guard ([Spec 004](../004-tax-compliance-guard/spec.md)) shipped (v1.0) as a separate module, so the question remains open in case a future Core `Finance & Compliance` bounded context is created.

---

## 13. Out of scope (binding for v1; supersedes the original Phase 0 framing)

> **Status (2026-07-01):** v1 shipped (PR #13). The "Phase 0 (no implementation)" framing of the original draft is retired; this section is the current binding list of what Spec 001 does NOT cover, regardless of version.

- **Not** official/statutory accounting or a system of record for compliance (carried over from §10).
- **Not** definitive tax calculation (no VAT/IVA, no income tax, no withholdings) — Tax & Compliance Guard ([Spec 004](../004-tax-compliance-guard/spec.md)) shipped separately; this spec does not absorb it.
- **No** SII or any tax-authority integration.
- **No** bank or payment-processor integration; no real banking data.
- **No** full double-entry bookkeeping, chart of accounts, or ledgers.
- **No** multi-currency math (single tenant currency; Q4 closed).
- **No** scheduled snapshots (Phase 2 / Workflow Engine dependency; Q1 closed).
- **No** probability weighting on `expected` items (Q5 closed; face value).
- **Not** a replacement for an accountant; outputs are *indicative*, labeled *approximate*.
- The Tax & Compliance Guard ([Spec 004](../004-tax-compliance-guard/spec.md)) is a separate Module; this spec does not redefine obligation or compliance concerns.
- The Core `Finance & Compliance` context, if ever created, is a future ADR; this spec does not pre-decide how Revenue Visibility would fold or stay (Q6 deliberately unresolved).
- Integrations (bank, tax authority, accounting software) are a future spec, not this one.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Identity](../../docs/identity.md). Module of origin: [Tenant 0](../../blueprints/tenants/tenant-0-founder-profile.md). Spec-first, conceptual only.*
