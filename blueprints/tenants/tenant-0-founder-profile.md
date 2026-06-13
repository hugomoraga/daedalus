# Tenant 0 — Founder Profile

**Status:** Foundational · Phase 0 · **Tenant-scoped (NOT Core)**
**Version:** 0.1.0
**Last updated:** 2026-06-13
**Tenant:** `tenant-0`
**Subject:** The founder's independent professional activity

> **What this document is.** This is the *first concrete tenant* Daedalus operates. Everything founder-specific lives **here**, never in the [Core](../../docs/identity.md) or [Constitution](../../memory/constitution.md). This profile selects modules, sets tenant parameters, and records context. It is the validation case that proves the architecture against real pain — and it is deliberately quarantined so the platform never overfits to it. (Constitution, Principle 10; Decision Hierarchy, Article III.)
>
> **No personal data by design.** This profile is conceptual in Phase 0. Real identifiers, financials, client names, and tax identifiers are **not** stored here. Fields below marked `[founder to confirm]` are placeholders for the human to supply later in the appropriate (isolated, tenant-scoped) location — not in this spec, and never as PII committed to the repository.

---

## 1. Who Tenant 0 Is

- **Type:** independent technical founder / builder operating solo.
- **Activity:** independent professional services (architecture, problem-solving, building). `[founder to confirm exact scope]`
- **Jurisdiction (for tax/compliance):** `[founder to confirm — drives Tax & Compliance Guard rules]`
- **Stage:** establishing and operating the independent activity sustainably.

Tenant 0 is **one** organization Daedalus could operate. The platform must remain able to operate a different founder with a different profile and no code change.

---

## 2. The Founder's Real Pain (the source of the first modules)

These are the concrete frictions that justify the initial modules. They are **Tenant 0's** pains; other tenants may share them, which is exactly why the modules are built to be reusable.

| # | Pain | Why it costs the founder | Severity |
|---|---|---|---|
| 1 | **Finding clients** | Opportunity discovery is ad hoc and unrecorded; good leads are dropped; the pipeline lives in memory. | High |
| 2 | **Basic accounting** | Revenue, costs, and what's actually owed are scattered; no clear picture of solvency. | High |
| 3 | **Tax & compliance** | Obligations and deadlines create low-grade dread and real financial/legal risk. | High |

Underneath all three: **the administrative tail consumes the attention that makes the founder valuable.**

---

## 3. The Human Goal for Tenant 0

Free the founder to spend time on **judgment, creativity, architecture, and problem-solving** — and have the system absorb coordination, administration, and repetitive execution. Success is measured in **attention returned**, not throughput added. (See [Identity §4](../../docs/identity.md).)

---

## 4. Initial Modules — derived from pain, designed reusable

Each module below is **born** from a Tenant 0 pain but **specified** as a generic, reusable capability. The pain motivates it; the design must not assume Tenant 0.

| Module | Solves pain | What it absorbs | Reusable for any tenant that… |
|---|---|---|---|
| **Opportunity Discovery** | Finding clients (1) | Surfacing, capturing, and qualifying opportunities so none are dropped. Feeds `Lead`. | …needs to find and not-lose prospective work. |
| **Proposal Generation** | Finding clients (1) | Turning a qualified opportunity into a proposal with less manual effort. Feeds `Proposal`. | …converts interest into formal offers. |
| **Revenue Visibility** | Basic accounting (2) | A continuous, trustworthy picture of revenue, what's owed, and solvency. Projection over invoice/payment events. | …needs to know if it is solvent without doing bookkeeping by hand. |
| **Tax & Compliance Guard** | Tax & compliance (3) | Tracking obligations and deadlines; flagging risk before it becomes a problem. | …operates under tax/compliance obligations. |
| **Administrative Shield** | All three (the tail) | Intercepting administrative tasks so they reach the founder only as decisions, not as chores. | …wants administration handled without founder attention. |

> **Design constraint (constitutional).** If any of these modules turns out to only work for Tenant 0, it has failed Principle 10 and must be redesigned. The founder's specifics that a module needs (jurisdiction, thresholds, preferences) are supplied *by this profile*, not hard-coded *into the module*.

### Pain → Module → Value-chain mapping

```
Pain 1: Finding clients
  → Opportunity Discovery ──► Lead
  → Proposal Generation  ──► Proposal → Approval → Project

Pain 2: Basic accounting
  → Revenue Visibility    ──► (projection over Invoice / Payment events)

Pain 3: Tax & compliance
  → Tax & Compliance Guard ─► (obligations & deadlines around Invoice / Payment)

The tail (all pains)
  → Administrative Shield  ─► (intercepts admin across the whole chain)
```

---

## 5. Tenant 0 Configuration (conceptual)

What this tenant selects from the Core — **no implementation, no schema**:

- **Modules enabled:** Opportunity Discovery, Proposal Generation, Revenue Visibility, Tax & Compliance Guard, Administrative Shield.
- **Value chain:** the standard Core chain `Lead → Proposal → Approval → Project → Delivery → Invoice → Payment`.
- **Human-governed gates:** `[founder to confirm]` — at minimum, irreversible financial actions and proposal approval (per Constitution Article V).
- **Tax/compliance ruleset:** `[founder to confirm jurisdiction]` — parameterizes Tax & Compliance Guard.
- **Risk posture:** conservative — default-deny and escalate (inherits Core default; founder may tighten, never loosen below Core).

---

## 6. What Must NOT Leak Into the Core

Explicitly quarantined to Tenant 0 (the anti-"Hugo OS" checklist):

- The founder's identity, jurisdiction, clients, and financials.
- The specific tax ruleset and thresholds.
- Personal preferences about how work is done.
- Any assumption that the operator is a *solo technical founder* (a future tenant may be a studio or collective).

If any of the above appears in `memory/constitution.md`, `docs/`, `domains/`, or a module spec, that is a defect to be pushed back down here.

---

> **Edge cases / decisions flagged for the founder (human) to resolve:**
> - **Jurisdiction is load-bearing and unset.** Tax & Compliance Guard cannot be specified without it. This is the first blocker for any module spec touching tax.
> - **Where does real tenant data live?** This profile is conceptual; the isolated store for actual Tenant 0 data (and how it stays out of version control) is an open infrastructure decision, deferred but flagged.
> - **Module ownership.** Confirm these five modules are the right initial set, or whether one (e.g. Administrative Shield) is too broad to specify first and should be deferred.

---

*Tenant-scoped. Subordinate to the [Constitution](../../memory/constitution.md) and [Core Identity](../../docs/identity.md). Conceptual only — no implementation, no data, in Phase 0.*
