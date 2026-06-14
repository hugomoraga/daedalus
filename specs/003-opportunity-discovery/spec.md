# Spec 003 — Opportunity Discovery (Module)

**Status:** Ratified · Phase 1 (implementation)
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Validation priority:** #3 (see [Roadmap → Module Validation Sequence](../../docs/roadmap.md))
**Version:** 0.1.0
**Last updated:** 2026-06-14

> **Method.** Spec-first (Constitution, Principle 8). This document defines *what* Opportunity Discovery must do and *why*, not *how*. Conceptual domain language only — no code, API, schema, or UI.

---

## 1. Summary

Opportunity Discovery is the **third module by validation priority**. It solves the **top-of-funnel half** of the founder's *finding clients* pain: **surfacing, capturing, and qualifying opportunities so none are dropped**.

It lets a founder/tenant:

- **record** an opportunity (a potential engagement) as it surfaces — manually in this phase,
- **enrich** it with context (source, description, contact),
- **qualify** it into a Core `Lead` (the handoff to the existing Commercial value chain),
- **dismiss** it with a reason (recording *why not*, not just *that not*),
- keep every interaction **auditable**.

It is sequenced after Proposal Generation (#1) and Revenue Visibility (#2) because it **feeds the existing Core `Lead` aggregate** — the upstream entry point that already exists. Building Opportunity Discovery validates that a module can both **consume and produce** Core domain events cleanly, and that the `LeadCreated` / `LeadQualified` seed commands can be replaced by a richer upstream module.

> **What this module is NOT** (binding): it is **not** automated prospecting or lead generation (no web scraping, no CRM integration, no AI sourcing in v0). It does **not** bypass the Core Lead lifecycle. It does **not** replace the existing `lead:create` / `lead:qualify` commands (those remain in Core for direct use). It is an *input funnel* — it enriches the path *before* the Lead becomes a Lead, and records the decision trail.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates to it |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Everything is an Event* (opportunity decisions are events); *Auditability by Default* (every surface/qualify/dismiss is traceable); *Policy before Agent* (qualification is a human decision in this phase); *Generic Core, Specific Tenants* (this is a Module). |
| **[Identity](../../docs/identity.md)** | Litmus test: surfacing and qualifying opportunities is *a reusable solution to a class of pain* → a **Module**. Serves the human goal of returning attention; optimizes for traceability. |
| **[Tenant 0 Profile](../../blueprints/tenants/tenant-0-founder-profile.md)** | Realizes **Pain #1** — finding clients, specifically the *top-of-funnel* half. Tenant 0 supplies sources, labels, and qualification preferences; the module supplies the generic mechanism. |
| **[Domain Model](../../docs/domain-model.md)** | Operates *before* the Core Commercial context: an Opportunity is the pre-Lead artifact. Upon qualification, it produces a `Lead`. |
| **[Event Catalog](../../docs/event-catalog.md)** | Consumes no Core events directly (it is upstream). Produces `LeadCreated` + `LeadQualified` on qualification handoff. Adds module events in §6. |
| **[Spec 002 — Proposal Generation](../002-proposal-generation/spec.md)** | Downstream: a qualified Opportunity becomes a `Lead`, which Proposal Generation can then start a draft from. |
| **[Spec 001 — Revenue Visibility](../001-revenue-visibility/spec.md)** | No direct composition in v0. Revenue Visibility may later consume opportunity-level data for pipeline projection, but that's deferred. |

---

## 3. Goals

1. Give the founder a **single place to record opportunities** before they become Leads, so nothing is lost silently.
2. Make the **qualify/dismiss decision auditable** — recording *why* an opportunity was pursued or dropped.
3. Provide a **clean handoff** to the Core `Lead` lifecycle — qualification creates a `Lead`, not a shadow entity.
4. Work from **manual entry** in this phase (no integrations, no AI sourcing).
5. **Validate the upstream module pattern**: a module that both enriches and produces Core domain state.

---

## 4. Core / Module / Tenant split

### Lives in the **Core** (generic — reused, not defined here)
- The **Lead aggregate** and its lifecycle (`LeadCreated`, `LeadQualified`, `LeadDiscarded` — last one to be added).
- The **event substrate**: append-only Audit Log, lineage, tenant isolation.
- The **read-model / projection mechanism** (already exists: `projectLead`).

### Lives in the **Module** (Opportunity Discovery — defined here)
- The **Opportunity** concept and its lifecycle: `surfaced` → `qualified` | `dismissed`.
- The mechanism to **record an opportunity** (source, description, contact).
- The **qualification handoff**: when a `qualified` Opportunity produces a `LeadCreated` + `LeadQualified` event pair (the module triggers Core state).
- The **dismissal** with reason (auditability of negative decisions).
- The **module events** (§6).
- The **pipeline projection**: a read-model of the current opportunity funnel.

### Lives in the **Tenant** (Tenant 0 — specific, NOT here)
- Actual **opportunity data** (sources, names, contacts).
- **Source labels** and **qualification preferences** (if any).
- The **decision to enable** the module.

---

## 5. Domain concepts (conceptual — no schema)

- **Opportunity** — a potential engagement before it enters the formal pipeline. Carries: a human label, a source (where it came from), a description, optional contact info, and a state (`surfaced` | `qualified` | `dismissed`). The *live enrichment* of a surfaced opportunity is a read-model/work-area (like the proposal draft — edits emit no events).
- **Opportunity Source** — a label for where the opportunity came from (e.g., "referral", "cold", "conference"). Tenant-supplied, not hard-coded (Principle 10).
- **Qualification** — the deliberate decision that an opportunity is worth pursuing. This **produces** a Core `Lead` (emitting `LeadCreated` + `LeadQualified`). The module does not own the Lead; it hands it off, like Proposal Generation hands off `ProposalGenerated`.
- **Dismissal** — the deliberate decision *not* to pursue. Carries a reason (why it was dropped). This is the negative outcome that the audit trail must preserve.
- **Pipeline** — the read-model: counts and lists of opportunities by state. Derived from the event stream; emits no event on recomputation.

### Lifecycle

```
surfaced ──(enrich: read-model, no event)──► surfaced
    │ qualify                                    │ dismiss
    ▼                                            ▼
qualified (→ Core Lead)              dismissed (with reason)
```

After qualification, the Opportunity is no longer editable — it has handed off to the Core. After dismissal, it is closed.

---

## 6. Events vs read-model

**Decision:** the **live enrichment** of a surfaced opportunity is a **read-model/work-area** and emits **no event per change**. Events fire **only** on deliberate facts/decisions — consistent with Spec 001 and Spec 002.

### Module events (auditable facts & decisions)

| Event | Emitted when | Why it earns an event |
|---|---|---|
| `OpportunitySurfaced` | A founder records a potential engagement. | The origin of a pipeline entry; a deliberate human input. |
| `OpportunityEnriched` | A surfaced opportunity's description, source, or contact is updated. | Enrichment records what was known *when* — important for qualification quality review. Minimal: only emits on explicit save, not per keystroke. |
| `OpportunityQualified` | An opportunity is judged worth pursuing and handed off to the pipeline. | A commitment decision — it creates a Lead and closes the opportunity for further editing. |
| `OpportunityDismissed` | An opportunity is deliberately dropped with a reason. | Records *why not* — protects focus and enables pipeline quality analysis. |

### Core events produced on handoff (not redefined here)

- On qualification: `LeadCreated` + `LeadQualified` — the Core events. The module emits the module milestone `OpportunityQualified` and the use case produces the Core event pair (same pattern as `ProposalDraftFinalized` + `ProposalGenerated`).

> **Re-enrichment is an event, unlike draft editing.** Rationale: an Opportunity's source/contact/description at the time of qualification is meaningful for audit (what did we know when we qualified?). Draft edits are internal work; opportunity enrichment records *what was known* at a decision point. Unlike a draft that is thrown away 90% of the time, an opportunity's enrichment directly feeds the qualify/dismiss decision.

---

## 7. User stories

- **US-1 — Record an opportunity.** As a founder, I want to record an opportunity with a source and basic description, so that potential work is captured before I forget it.
- **US-2 — Enrich an opportunity.** As a founder, I want to add context (description, contact) to a surfaced opportunity, so that I have information at the qualify/dismiss decision point.
- **US-3 — Qualify an opportunity into a Lead.** As a founder, I want to qualify a surfaced opportunity, so that it enters the formal pipeline as a `Lead` that Proposal Generation can pick up.
- **US-4 — Dismiss an opportunity.** As a founder, I want to dismiss an opportunity with a reason, so that the "why not" is recorded and I can review pipeline quality later.
- **US-5 — View the pipeline.** As a founder, I want to see my current pipeline (surfaced, qualified, dismissed), so that I know what's cooking at a glance.
- **US-6 — No silent loss.** As a founder, I want every opportunity's state to be reconstructable from the event stream, so that nothing is silently dropped.
- **US-7 — Auditability.** As a founder (or steward), I want every opportunity decision to carry tenant, actor, cause, and lineage, so that I can trust the record.

---

## 8. Acceptance criteria

> Given / When / Then. Each ties to a story.

**AC-1 (US-1 — surface):**
- *Given* an opportunity with a source and label, *when* the founder records it, *then* an `OpportunitySurfaced` event is emitted (tenant-scoped, with lineage) and the opportunity appears in the pipeline as `surfaced`.

**AC-2 (US-2 — enrich):**
- *Given* a `surfaced` opportunity, *when* the founder enriches it with description and/or contact, *then* an `OpportunityEnriched` event is emitted carrying the updated fields.
- *Given* a `qualified` or `dismissed` opportunity, *when* enrichment is attempted, *then* it is rejected (these states are closed).

**AC-3 (US-3 — qualify):**
- *Given* a `surfaced` opportunity, *when* the founder qualifies it, *then* `OpportunityQualified` is emitted **and** one `LeadCreated` + one `LeadQualified` are emitted with lineage tying them back to the opportunity (`correlationId` shared, `causationId` linking).
- *Given* a `qualified` opportunity, *when* qualification is re-attempted, *then* it is rejected (idempotent handoff).

**AC-4 (US-4 — dismiss):**
- *Given* a `surfaced` opportunity, *when* the founder dismisses it with a reason, *then* `OpportunityDismissed` is emitted with the reason, and no Core Lead is created.
- *Given* a `qualified` or `dismissed` opportunity, *when* dismissal is attempted, *then* it is rejected.

**AC-5 (US-5 — pipeline):**
- *Given* recorded opportunities, *when* the founder views the pipeline, *then* it shows opportunities grouped by state (surfaced / qualified / dismissed), derived from the event stream, with no event emitted by the act of viewing.

**AC-6 (US-6 — no silent loss):**
- *Given* the event stream, *when* replayed, *then* every opportunity's state transitions are fully reconstructable (no state held outside events).

**AC-7 (US-7 — auditability):**
- *Given* any module event, *when* it is emitted, *then* it carries tenant, actor, cause, and lineage.

**AC-8 (isolation):**
- *Given* two tenants, *when* either views its pipeline, *then* it reflects only that tenant's data; no cross-tenant leakage.

---

## 9. Alert rules (not in v0)

Opportunity Discovery could surface pipeline health signals (stale surfaced opportunities, low qualification rate), but these are **deferred** pending evidence. The module is built to allow them later via the same alert pattern as Revenue Visibility, but none are specified now (*Simplicity First*).

---

## 10. Non-goals (binding)

- **Not** automated prospecting, scraping, or AI sourcing (that is a future bounded-agent enhancement under policy).
- **No** CRM, contact management, or relationship history beyond a single contact field on the opportunity.
- **No** scoring, weighting, or probability assignment (face value only, consistent with Spec 001 Q5).
- **No** multi-step qualification workflows or pipeline stages beyond `surfaced → qualified | dismissed`.
- **No** integration with external sources (email, CRM, social) in v0.
- **No** UI, API, or database — spec-first.
- **Not** a replacement for the Core `Lead` aggregate — Opportunities supplement Leads, they don't replace them.

---

## 11. Risks

- **R1 — Opportunity vs Lead confusion.** If the boundary between Opportunity and Lead is unclear, people will use one when they mean the other. *Mitigation:* the handoff is explicit and one-directional. Qualification is a deliberate commitment that creates a Lead. The module does not overlay on top of Leads.
- **R2 — Enrichment event noise.** Emitting `OpportunityEnriched` on every edit could flood the log. *Mitigation:* enrichment is an explicit save action, not per-keystroke; the founder chooses when to commit enrichment. If this proves noisy in practice, it can be consolidated (future enhancement).
- **R3 — Pipeline scope creep.** Pressure to add stages, scoring, or automation would violate scope. *Mitigation:* non-goals are binding; such needs spawn new specs.
- **R4 — Founder-specific sources leaking into the module.** *Mitigation:* source labels are tenant data; the module ships none (consistent with Spec 002 R4 on templates).
- **R5 — Qualification producing a duplicate Lead.** If the founder also uses `lead:create` directly, they could create a Lead that shadows the one from Opportunity qualification. *Mitigation:* the module's `OpportunityQualified` event carries the `opportunityId` in the `LeadCreated` payload, making the linkage explicit. A future policy could prevent duplicates.

---

## 12. Open questions

- **Q1 — Enrichment event granularity.** Should `OpportunityEnriched` be a single event with all updated fields, or one event per field? *Recommendation: single event with all updated fields for v0 (Simplicity First).*
- **Q2 — Lead linkage.** Should the Core `LeadCreated` payload include `opportunityId` to trace the origin? This touches the Core event payload — similar to Spec 002 Q5. *Recommendation: yes, as an optional field. Resolved at implementation — smallest generic change.*
- **Q3 — Dismissal reason taxonomy.** Should reasons be free text or a tenant-defined enum? *Recommendation: free text in v0. A tenant could define a taxonomy later, but the module must not prescribe one (Principle 10).*
- **Q4 — Opportunity → Lead cardinality.** Can an opportunity be re-qualified after dismissal? *Recommendation: no in v0. A dismissed opportunity is closed. A new opportunity can be surfaced for the same prospect.*

---

## 13. Out of scope for Phase 0 (what comes next, not now)

- Implementation is authorized by the accompanying plan.md.
- This spec does not authorize automated sourcing, scoring, or integration.
- Opportunity Discovery matures into an orchestrated form in Phase 2, when the Workflow Engine can automate pipeline movement.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Identity](../../docs/identity.md). Module of origin: [Tenant 0](../../blueprints/tenants/tenant-0-founder-profile.md). Spec-first, conceptual only.*