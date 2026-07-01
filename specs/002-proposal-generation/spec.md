# Spec 002 — Proposal Generation (Module)

**Status:** Ratified · **v1 SHIPPED** (Phase 2 orchestrated form — PR #32, T-15..T-18 ✅; ATLAS Phase 2 panels T-19 ✅ in Spec 007 / PR #69)
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Validation priority:** #1 (see [Roadmap → Module Validation Sequence](../../docs/roadmap.md))
**Version:** 1.1.0
**Last updated:** 2026-07-01

> **Method.** Spec-first (Constitution, Principle 8). This document defines *what* Proposal Generation must do and *why*, not *how*. No code, no API, no database schema, no UI, no e-signature, no CRM/email integration, no real data. Conceptual domain language only.

---

## 1. Summary

Proposal Generation is the **first module by validation priority** because it attacks the founder's existential pain — **customer acquisition** — at the point the founder actually controls: **turning a qualified lead into a compelling, structured offer, faster**.

It lets a founder/tenant:

- start a proposal from a **qualified lead** (no blank page),
- apply a **reusable template/structure** (consistency + speed),
- define **scope/deliverables** and **simple pricing line items**,
- **revise** the draft before finalizing,
- **finalize** a draft into an official Core `Proposal` (emitting `ProposalGenerated`), ready to submit,
- keep every relevant decision **auditable**.

> **What this module is NOT** (binding): it is **not lead generation** (finding new prospects is Opportunity Discovery, #3) and **not a CRM**. It does **not** execute contracts or e-signatures, does **not** send anything to customers automatically, does **not** include a pricing/quoting engine, and does **not** mandate AI drafting in v0. It assembles offers; it does not close them on the founder's behalf.

> **Scope note (mission).** Choosing this module first is an **incremental validation strategy**. It does not redefine Daedalus's mission or establish the system's root entity (per the v0.3.0 roadmap decision).

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates to it |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Everything is an Event* (deliberate offer decisions are events; the live draft is a read-model — §6); *Auditability by Default* (every version/decision traceable); *Human Governance* (the founder finalizes content and the approval gate stays human — Article V); *Policy before Agent* (any future drafting agent acts within policy); *Generic Core, Specific Tenants* (this is a Module — §4); *Simplicity First* (assembly, not a quoting engine). |
| **[Identity](../../docs/identity.md)** | Litmus test (§6 there): converting interest into offers is *a reusable solution to a class of pain* → a **Module**. Serves the human goal (return the founder's attention from proposal drudgery to judgment) and optimizes traceability/sustainability, not growth. |
| **[Tenant 0 Profile](../../blueprints/tenants/tenant-0-founder-profile.md)** | Realizes **Pain #1 — finding clients**, specifically the *closing/conversion* half. Tenant 0 supplies templates, default terms, pricing defaults, language; the module supplies the generic assembly mechanism. |
| **[Domain Model](../../docs/domain-model.md)** | Operates over the Core **Commercial** context: consumes a qualified `Lead`, produces a `Proposal`. Adds no new Core bounded context. The approval gate remains a Core, human-governed decision. |
| **[Event Catalog](../../docs/event-catalog.md)** | Consumes/produces the existing Core value-chain events (`LeadQualified`, `ProposalGenerated`, `ProposalSubmitted`, `ProposalApproved/Rejected`); adds the module draft events in §6. |
| **[Spec 001 — Revenue Visibility](../001-revenue-visibility/spec.md)** | **Cross-module composition (key validation):** a finalized proposal's *expected value* feeds Revenue Visibility's `expected` revenue (Spec 001, US-2/AC-2). This is the first real test that two modules compose over the shared event substrate. See §4.1. |

---

## 3. Goals

1. Cut the time and friction of producing a quality proposal from a qualified lead.
2. Make proposals **consistent** via reusable, tenant-owned templates.
3. Keep the founder **in control**: assembly assists, the founder decides and finalizes.
4. Make every offer **auditable**: what was offered, in what version, when, by whom.
5. Work from **manual or mock, tenant-scoped data** in this phase (no integrations).
6. **Validate module composition**: prove Proposal Generation feeds Revenue Visibility cleanly.

---

## 4. Core / Module / Tenant split

The central architectural discipline. Each concern in exactly one layer.

### Lives in the **Core** (generic — reused, not defined here)
- The **Commercial** aggregates: `Lead` and `Proposal`, and their lifecycle.
- The **event substrate**: append-only Audit Log, event emission, lineage; **tenant isolation**.
- Core value-chain events: `LeadQualified` (consumed), `ProposalGenerated`, `ProposalSubmitted`, `ProposalApproved`, `ProposalRejected`.
- The **approval gate** as a human-governed decision (Article V).
- The **policy engine** (Phase 3) that will govern any drafting agent and any future automated send.

### Lives in the **Module** (Proposal Generation — defined here)
- The **proposal draft** concept and its assembly lifecycle (§5, §9).
- The mechanism to **start a draft from a qualified lead** and **apply a template**.
- The representation of **scope/deliverables** and **simple pricing line items** (no engine).
- **Revision** of a draft and **finalization** into a Core `Proposal`.
- The **module events** (§6) for deliberate draft decisions.
- (Future) **drafting assistance** — a bounded agent under policy; out of v0.

### Lives in the **Tenant** (Tenant 0 — specific, NOT here)
- **Templates**, **default terms**, **pricing defaults**, **branding**, **language**.
- The actual **proposal content and client data**.
- The **decision to enable** the module.

> **Anti-overfitting rule (Principle 10).** Templates and terms are *tenant data*, never hard-coded into the module. A second tenant must adopt Proposal Generation with its own templates and no module change. A module that only assembles *the founder's* style of proposal is a defect.

### 4.1 Cross-module composition — feeding Revenue Visibility

When a draft is finalized into a Core `Proposal` and `ProposalGenerated` is emitted, the proposal's **expected value** becomes an `expected` revenue item in [Revenue Visibility](../001-revenue-visibility/spec.md). The flow:

```
qualified Lead → (Proposal Generation: assemble draft) → finalize
  → Core ProposalGenerated (carries expected value)
    → Revenue Visibility reflects it as `expected` revenue
      → on ProposalApproved → `confirmed`; on PaymentReceived → `received`
```

> **Open question raised by this (Q5):** does the Core `ProposalGenerated` event need to carry an **expected value** attribute so Revenue Visibility can consume it? This touches a Core event's payload. **Do not redefine the Domain Model now** (per the standing decision to learn by building). Flag it; resolve at implementation.

---

## 5. Domain concepts (conceptual — no schema)

- **Proposal Draft** — the module's work artifact: an in-progress offer assembled from a qualified lead. Conceptually carries: a link to the source `Lead`, an applied **template**, **scope/deliverables**, **pricing line items**, **terms**, and a **state** (`draft` | `finalized` | `discarded`). The *live editing* of a draft is a read-model/work-area (no event per change — §6).
- **Template** — a reusable, tenant-owned structure (sections, default terms, default pricing shape). Provided by the tenant; applied by the module.
- **Pricing Line Item** — a simple `label + amount` pair (and quantity, optionally). Flat and manual in this phase; **no calculation engine, no tax** (tax is Tax & Compliance Guard, #4, deferred).
- **Proposal (Core)** — the official aggregate created when a draft is finalized. From this point the artifact lives in the Core value chain; the module no longer owns it.

### Derived/expected value (conceptual)
- **Expected value** = sum of the draft's pricing line items (single tenant currency — Q2). Carried forward on finalization to feed Revenue Visibility (§4.1).

---

## 6. Events vs read-model (consistent with Spec 001)

**Decision:** the **live draft being edited is a read-model/work-area** and emits **no event per change**. Events fire **only** on deliberate facts/decisions — same inclusion test as the Event Catalog ("would a steward want this in the audit trail?").

### Module events (auditable draft decisions)

| Event | Emitted when | Why it earns an event |
|---|---|---|
| `ProposalDraftCreated` | A founder starts a draft from a qualified lead (and applies a template). | A deliberate act; the origin of an offer artifact, linked to a `Lead`. |
| `ProposalDraftFinalized` | A founder finalizes a draft's content. | A human decision that the offer is ready. **Triggers the Core `ProposalGenerated`** — the module does not emit `ProposalGenerated` itself (no duplication; see R1). |
| `ProposalDraftDiscarded` | A draft is abandoned. | Records the decision *not* to pursue an offer — protects focus and lets conversion quality be reviewed. |

### Core events (existing, consumed/produced — not redefined here)
- **Consumed:** `LeadQualified` (a draft can only start from a qualified lead).
- **Produced (via finalization):** `ProposalGenerated`, then the Core path continues with `ProposalSubmitted`, `ProposalApproved` / `ProposalRejected`.

> **No event for intermediate revisions.** Editing the draft does not emit events. If a *versioned history* of revisions is later required for audit, that is an explicit enhancement (Q3) — not assumed now (Simplicity First).

### Orchestrated form (v1, Phase 2)

v0 of this module is **driven manually** — the founder runs each CLI command (start, add-item, set-scope, finalize, discard). v1 makes the two transition points the workflow engine can drive automatically:

- **Auto-start on `LeadQualified`.** The [Workflow Engine](../008-workflow-engine/spec.md) observes `LeadQualified` arriving for a tenant whose workflow is `lead-to-payment` v0.2.0 (or later). The transition's `actions` invoke `startDraftUseCase` (this module's own use case) so a draft is created automatically with the standard template. The founder no longer runs `proposal:start` manually for tenants running the v0.2.0 workflow.
- **Auto-project on `ProposalApproved`.** Today, `ProposalApproved` is followed by the founder running `project:create`. In v0.2.0 of `lead-to-payment`, the workflow's `ProposalApproved → approved` transition invokes `createProjectUseCase` (Core) so the project is created automatically. The CLI command remains available (idempotent); the workflow just removes the manual step.

Both auto-actions are **observational via lineage**: the engine captures every event the actions emit and references their ids in `WorkflowTransitionFired.payload.actionEventIds`. The audit trail distinguishes workflow-driven actions from CLI-driven ones.

> **Why two auto-steps and not the full lifecycle?** The remaining steps (add-item, set-scope, finalize, submit, approve, reject) are decisions the founder must make; they cannot be automated from the event stream alone. The orchestrated form covers what *can* be automated and leaves the human decisions where they belong (Constitution Article V).

> **Boundary discipline.** The engine's `UseCaseRegistry` is built by the composition root (engine CLI or tests). Module use cases like `startDraftUseCase` join the registry alongside Core use cases. Each invoker carries its own module-specific deps (e.g. `DraftStorePort`) at registry-construction time; the engine itself stays Core-only.

---

## 7. User stories

- **US-1 — Start from a qualified lead.** As a founder, I want to start a proposal from a qualified lead, so that I never begin from a blank page.
- **US-2 — Apply a template.** As a founder, I want to apply a reusable template, so that proposals are consistent and fast.
- **US-3 — Define scope and pricing.** As a founder, I want to set scope/deliverables and simple pricing line items, so that the offer is clear and its expected value is known.
- **US-4 — Revise before finalizing.** As a founder, I want to revise the draft freely before finalizing, so that I control the content.
- **US-5 — Finalize into a Proposal.** As a founder, I want to finalize a draft into an official Proposal, so that it enters the value chain (`ProposalGenerated`) and can be submitted.
- **US-6 — Discard a draft.** As a founder, I want to discard a draft I won't pursue, so that abandoned offers are recorded, not silently lost.
- **US-7 — Audit offers.** As a founder (or steward), I want every draft decision and the finalized offer to be traceable, so that I can reconstruct what was offered and when.
- **US-8 — Feed financial visibility.** As a founder, I want a finalized proposal's expected value to appear in my financial picture, so that my pipeline reflects expected revenue without re-entry.

---

## 8. Acceptance criteria

> Given / When / Then. Each ties to a story.

**AC-1 (US-1):**
- *Given* a `Lead` in `qualified` state, *when* the founder starts a draft, *then* a `ProposalDraftCreated` event is emitted (tenant-scoped, with lineage) linking the draft to that lead.
- *Given* a `Lead` **not** qualified, *when* a draft start is attempted, *then* it is rejected (a draft can only originate from a qualified lead).

**AC-2 (US-2):**
- *Given* a tenant template, *when* the founder applies it, *then* the draft is populated with that template's structure and tenant defaults (terms, pricing shape).

**AC-3 (US-3):**
- *Given* a draft, *when* the founder sets scope and pricing line items, *then* the draft's expected value equals the sum of line items in the tenant currency, with no tax computed.

**AC-4 (US-4):**
- *Given* a `draft`-state proposal, *when* the founder revises it, *then* the changes are reflected in the read-model and **no event is emitted** for the edit.

**AC-5 (US-5 — finalization):**
- *Given* a `draft`, *when* the founder finalizes it, *then* `ProposalDraftFinalized` is emitted **and** the Core `ProposalGenerated` is emitted exactly once for the resulting `Proposal`; the draft transitions to `finalized` and is no longer editable as a draft.

**AC-6 (US-6):**
- *Given* a `draft`, *when* the founder discards it, *then* `ProposalDraftDiscarded` is emitted and the draft transitions to `discarded`; no Core `Proposal` is created.

**AC-7 (US-7 — auditability):**
- *Given* any module event, *when* emitted, *then* it carries tenant, actor, cause, and (where governed) authorizing policy, and is appended to the Audit Log immutably.
- *Given* the event stream, *when* replayed, *then* which leads produced finalized/discarded proposals is fully reconstructable.

**AC-8 (US-8 — composition with Revenue Visibility):**
- *Given* a finalized proposal with an expected value, *when* `ProposalGenerated` is emitted, *then* Revenue Visibility reflects that value as `expected` revenue (per Spec 001 AC-2) without manual re-entry.

**AC-9 (isolation):**
- *Given* two tenants, *when* either assembles proposals, *then* templates, drafts, and events are scoped to that tenant only; no cross-tenant leakage.

**AC-10 (orchestrated auto-start — v1):**
- *Given* the Workflow Engine is running with a `lead-to-payment` workflow version ≥ v0.2.0 loaded for a tenant, *when* a `LeadQualified` event arrives for that tenant's stream, *then* the engine invokes `startDraftUseCase` (this module's use case) with `{ tenantId, leadId, template: "standard" }`, which emits exactly one `ProposalDraftCreated` event whose `leadId` matches. *And* the resulting `WorkflowTransitionFired` event carries the `ProposalDraftCreated` event id in `actionEventIds`.
- *Given* a tenant running workflow version < v0.2.0, *when* `LeadQualified` arrives, *then* no `ProposalDraftCreated` is emitted by the engine (the auto-action only applies to v0.2.0+).

**AC-11 (orchestrated auto-project — v1):**
- *Given* the Workflow Engine is running with `lead-to-payment` ≥ v0.2.0 loaded, *when* a `ProposalApproved` event arrives for that tenant, *then* the engine invokes `createProjectUseCase` (Core), which emits exactly one `ProjectCreated` event for that proposal. *And* the resulting `WorkflowTransitionFired` event carries the `ProjectCreated` event id in `actionEventIds`.

---

## 9. Proposal lifecycle (module → Core handoff)

```
Core:   Lead ──(LeadQualified)──►  qualified
                                      │ start draft
Module:                               ▼
            draft ──(revise: read-model, no event)──► draft
              │ finalize                   │ discard
              ▼                            ▼
       (ProposalDraftFinalized)     (ProposalDraftDiscarded)
              │                            │
              ▼                            ▼
Core:  ProposalGenerated  ──► (handoff: Core owns it now)   [no Core Proposal]
              │
              ▼
       ProposalSubmitted ──► ProposalApproved / ProposalRejected   (approval = human gate)
```

The module owns the **draft**; the Core owns the **Proposal** from `ProposalGenerated` onward. The boundary is the finalization event. This clean handoff is what keeps the module reusable and the Core generic.

---

## 10. Non-goals (binding)

- **Not** lead generation / prospecting (that is Opportunity Discovery, #3).
- **Not** a CRM; lead capture and qualification belong to the Core `Lead` and Opportunity Discovery.
- **No** pricing/quoting engine, discount logic, or cost modeling — flat manual line items only.
- **No** tax computation on pricing (Tax & Compliance Guard, #4, deferred; no SII).
- **No** contract execution, e-signature, or legal document generation.
- **No** automated sending to customers; `ProposalSubmitted` remains a Core act, manual in this phase (no email/integration).
- **No** approval automation; approval stays a human-governed Core gate (Article V).
- **No** mandated AI drafting in v0; drafting assistance is a future, bounded-agent enhancement under policy.
- **No** UI, API, schema, or code in this spec (spec-first); **no real client data / PII**.

---

## 11. Risks

- **R1 — Duplicated `ProposalGenerated`.** The module must not emit `ProposalGenerated` itself; finalization triggers the single Core event. *Mitigation:* §6 and AC-5 make finalization the sole trigger; the module emits only `ProposalDraftFinalized`.
- **R2 — Template rigidity vs. fit.** Over-templating produces generic proposals that lose deals. *Mitigation:* tenant-owned templates with free-form sections; the module enforces structure, not content. **Edge case for human review.**
- **R3 — Scope creep.** Pressure toward a quoting engine, e-sign, or CRM would violate scope and Principle 10. *Mitigation:* non-goals are binding; such needs spawn new specs/modules.
- **R4 — Founder-specific templates leaking into the module.** *Mitigation:* templates/terms are Tenant data; the module ships none.
- **R5 — Premature AI expectations.** Stakeholders may expect AI-written proposals in v0. *Mitigation:* v0 is assembly; AI drafting is explicitly future and must run as a bounded agent under policy (Phase 4).
- **R6 — Core payload coupling.** Feeding Revenue Visibility may pressure adding an expected-value field to the Core `ProposalGenerated` event (Q5). *Mitigation:* flag, do not redefine the Domain Model now; resolve at implementation with the smallest generic change.

---

## 12. Open questions

- **Q1 — Draft as first-class concept?** Is the draft a transient work-area (read-model + milestone events, as specified) or does it deserve richer first-class modeling? *Recommendation: keep it lean as specified; revisit only if real use demands it.*
- **Q2 — Currency & pricing.** Single tenant currency assumed (aligns with Spec 001 Q4). Confirm Tenant 0's currency; multi-currency is a future spec.
- **Q3 — Revision history.** Do we need a versioned audit trail of draft revisions, or only the finalized snapshot? *Recommendation: finalized snapshot only for v0 (Simplicity First).*
- **Q4 — Template authoring.** How are tenant templates created/managed? Likely a small tenant-configuration concern; confirm it stays tenant-scoped and out of the module core.
- **Q5 — Expected value on `ProposalGenerated` (Core).** Does the Core event need an expected-value attribute to feed Revenue Visibility? Touches Core payload — deferred to implementation, smallest generic change. **(Cross-module, important.)**
- **Q6 — Drafting assistance (AI).** In scope later as a bounded agent under policy? Which approach/provider? Deferred to a future spec; not in v0.

---

## 13. Out of scope (binding)

- **Deeper orchestration.** v1 automates the two transition points the engine can drive (start-draft on `LeadQualified`, create-project on `ProposalApproved`). It does **not** auto-finalize, auto-submit, or auto-approve — those decisions remain with the founder (Constitution Article V; Spec 008 §11 non-goal "no agent runtime").
- **Richer tenant templates (T-12 in tasks).** v1 ships the standard template; richer tenant-owned templates are a follow-on that requires Tenant 0 to author them.
- **`expectedValue` on the Core `ProposalGenerated` event (T-13, Q5).** The v0 contract already carries `expectedValue` as an optional payload field; whether to promote it to a formal Core attribute is a cross-module decision (touches Core event payload) that requires its own ADR.
- **Drafting assistance (AI, T-14).** Bounded agent under policy; Phase 4+; out of v1.
- Opportunity Discovery (#3), Tax & Compliance Guard (#4), Administrative Shield (#5) — separate specs, deferred.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Identity](../../docs/identity.md). Module of origin: [Tenant 0](../../blueprints/tenants/tenant-0-founder-profile.md). Composes with [Spec 001 — Revenue Visibility](../001-revenue-visibility/spec.md). Spec-first, conceptual only.*
