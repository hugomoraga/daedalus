# Spec 004 — Tax & Compliance Guard (Module)

**Status:** Draft · **BLOCKED** (2 of 4 unblockers built · B3 still pending) · stub only
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Validation priority:** #4 (see [Roadmap](../../docs/roadmap.md)) · earliest buildable: **Phase 3** (policy-shaped)
**Version:** 0.4.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). **This is a stub, not a full spec.** It frames the problem, fixes the boundary, and records the blockers. It deliberately does **not** specify tax rules, rates, forms, or deadlines, because doing so would either be premature or jurisdiction-specific guesswork. No code, no schema, no real data, no PII.
>
> **Update (v0.4.0, 2026-06-22).** **B2 is CLOSED** — [Spec 009 — Policy Engine](../009-policy-engine/spec.md) shipped (PR #36 governance + PR #38 impl): Core types (`Policy`, `PolicyRef`, `PolicyDecision` 3-outcome), `PolicyEnginePort` + `PolicyStorePort`, default evaluator (first-match-wins, no-match → escalate), `evaluateAndRecordPolicy` use case, two adapters (`InMemoryPolicyStore`, `FilesystemPolicyStore`), `PolicyDecisionRecorded` event with full lineage, env-var pattern mirrored from Spec 008, conformance lint script wired into `npm test`. Spec 004's tax-compliance-policy bundle can now be authored and evaluated by the engine. **B3 (Authoritative Rule Source) is the only remaining blocker.**

---

## 1. Why this is a stub and not a spec yet

Tax & Compliance Guard is **#4 by priority and explicitly blocked** in the [Roadmap](../../docs/roadmap.md): *"Phase 3 (policy-shaped; blocked on jurisdiction)."* Two hard reasons to **not** write a full spec now:

1. **🚫 Jurisdiction is undefined as a generic parameter.** Tax rules are jurisdiction-specific by nature. Specifying them now would either hard-code Tenant 0's jurisdiction into a module (violating Principle 10, *Generic Core, Specific Tenants*) or invent rules with no authority. **We will not invent tax rules or rates.**
2. **🚫 The Policy engine (Phase 3) does not exist.** This module is *policy-shaped* by design — its whole value is expressing compliance obligations as first-class, versioned, testable policy (the [Policy-as-Code lineage](../../docs/domain-model.md) the canon already cites). Without that engine, a spec would describe a mechanism with no substrate.

> Writing the full spec now would violate *Simplicity First* (Constitution, Principle 9) and ADR-001's preference for evidence over premature modeling. This stub holds the place and records the gate.

---

## 2. Problem framing (the durable part)

Realizes **Tenant 0 Pain — taxes & compliance**: the founder must meet tax and regulatory obligations without that consuming the attention Daedalus exists to protect (Identity §3). The module's intent is to **watch obligations and surface them in time**, not to compute or file official taxes.

- **It is:** a *guard* — it flags obligations, deadlines, and risks for human action.
- **It is NOT:** a tax engine, an accountant, a system of record for compliance, or a filing tool. It does **not** compute definitive taxes and does **not** integrate with any tax authority (e.g. SII) in any near phase.

This boundary is consistent with Revenue Visibility (#2), which is explicitly *not* official accounting and explicitly defers all tax to this module ([Spec 001 §10](../001-revenue-visibility/spec.md)).

---

## 3. Core / Module / Tenant split (intended, not yet detailed)

- **Core:** event substrate, lineage, tenant isolation; the **Policy engine** (Phase 3) that evaluates obligation rules. Consumes existing financial events (`InvoiceIssued`, `PaymentReceived`).
- **Module:** generic obligation-watching logic and the obligation/deadline/risk concepts — expressed as policy.
- **Tenant:** the **jurisdiction**, applicable rules, rates, thresholds, and calendar. **All jurisdiction-specific content lives here, never in the Module.** This is the line that keeps the Core generic.

---

## 4. Blockers (must clear before a full spec)

| # | Blocker | Unblocker | Status |
|---|---|---|---|
| **B1** | **Jurisdiction model.** How a tenant declares its jurisdiction and supplies its rule set generically (so the Module stays jurisdiction-agnostic). | [Spec 008 — Jurisdiction Model](../008-jurisdiction-model/spec.md) shipped (PR #35) — Core types, ports, adapters, lint scripts, env-var pattern all live. | ✅ **Closed** |
| **B2** | **Policy engine (Phase 3).** Must exist; this module is policy-shaped. | [Spec 009 — Policy Engine](../009-policy-engine/spec.md) shipped (governance PR #37 + impl PR #38) — Core types, 3-outcome verdict, default evaluator, use case, two adapters, `PolicyDecisionRecorded` event, lint script. The tax-compliance-policy bundle can be authored and evaluated. | ✅ **Closed** |
| **B3** | **Authoritative rule source.** Tax rules must come from an authoritative, dated source per tenant — **never invented by the system or by an agent.** | [Spec 010 — Authoritative Rule Source](../010-authoritative-rule-source/spec.md) (stub; awaits human process design — how the founder sources, validates, and refreshes the rule set over time). | 🟡 Stubbed |
| **B4** | **Revenue Visibility lifecycle.** `confirmed`/`received` revenue must exist for obligations to compute against. | Shipped in [Spec 001 v1 (PR #13)](../001-revenue-visibility/tasks.md) — `RevenueConfirmed`, `RevenueReceived`, `ExpenseRegistered`, `FinancialSummary` all live. | ✅ **Closed** |

**Net:** the only remaining path to a buildable Spec 004 is **B2 → Phase 3**, with B1 ready to build today and B3 awaiting a human-authored process. Spec 004 itself stays a stub until Phase 3 begins.

## 5. 🚩 Compliance flag

This module touches legal/tax obligations directly. Any future spec **must** treat rule provenance as authoritative-source-only, keep the founder accountable for filings (Human Governance, Article V), and escalate to legal/tax. The system **guards**; it does not **decide** compliance.

---

## 6. Out of scope for now

- A full spec, acceptance criteria, events, or implementation of any kind.
- Any tax rule, rate, form, deadline, or jurisdiction content.
- SII or any tax-authority integration.
- This stub authorizes only: clearing B1–B4, then writing the full Spec 004.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Identity](../../docs/identity.md). Stub only — blocked on jurisdiction model and the Phase 3 Policy engine. No tax rules are specified or invented here.*
