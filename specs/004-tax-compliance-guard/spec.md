# Spec 004 — Tax & Compliance Guard (Module)

**Status:** Draft · **BLOCKED** (jurisdiction undefined) · stub only
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Validation priority:** #4 (see [Roadmap](../../docs/roadmap.md)) · earliest buildable: **Phase 3** (policy-shaped)
**Version:** 0.1.0
**Last updated:** 2026-06-14

> **Method.** Spec-first (Constitution, Principle 8). **This is a stub, not a full spec.** It frames the problem, fixes the boundary, and records the blockers. It deliberately does **not** specify tax rules, rates, forms, or deadlines, because doing so would either be premature or jurisdiction-specific guesswork. No code, no schema, no real data, no PII.

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

| # | Blocker | Owner |
|---|---|---|
| B1 | **Jurisdiction model.** How a tenant declares its jurisdiction and supplies its rule set generically (so the Module stays jurisdiction-agnostic). | Stewards + legal/tax |
| B2 | **Policy engine (Phase 3).** Must exist; this module is policy-shaped. | Platform roadmap |
| B3 | **Authoritative rule source.** Tax rules must come from an authoritative, dated source per tenant — **never invented by the system or by an agent.** | Tenant + legal/tax |
| B4 | **Revenue Visibility lifecycle.** `confirmed`/`received` revenue must exist (currently deferred — see [Spec 001 tasks T-06..T-09](../001-revenue-visibility/tasks.md)) for obligations to compute against. | Module #2 |

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
