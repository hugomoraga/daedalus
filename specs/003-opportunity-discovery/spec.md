# Spec 003 — Opportunity Discovery (Module)

**Status:** Draft · Phase 0 (specification only — no implementation) · **boundary deliberately open**
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Validation priority:** #3 (see [Roadmap → Module Validation Sequence](../../docs/roadmap.md)) · earliest buildable: **Phase 2**
**Version:** 0.1.0
**Last updated:** 2026-06-13

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* Opportunity Discovery must do and *why*, not *how*. No code, no schema, no API, no UI, no real data, no PII. Conceptual domain language only.

> **⚠️ This spec intentionally leaves one boundary unresolved.** A modeling review concluded that "Opportunity Discovery" may bundle **two** capabilities with different language, invariants, and lifecycle — **Discovery** (find / evaluate / prioritize) and **Engagement / Qualification** (contact / interact / detect interest / qualify). This spec records that as an **open decision** (§11) rather than resolving it. The decision is to be settled by **implementation evidence and a second non-consulting tenant**, not by more modeling — consistent with [ADR-001](../../governance/decisions/ADR-001-defer-root-entity-selection.md) and the [transformations-vs-capabilities modeling observation](../../blueprints/modeling-observation-transformations-vs-capabilities.md).

---

## 1. Summary

Opportunity Discovery is **module #3 by validation priority**: it attacks **customer acquisition at the top of the funnel** — the half of acquisition that happens *before* a qualified `Lead` exists. Proposal Generation (#1) consumes a qualified `Lead`; this module is one source that **populates** that `Lead` (per [Domain Model §3](../../docs/domain-model.md), `Lead` is "the entry point of the value chain, populated by the Opportunity Discovery module").

It lets a founder/tenant:

- record **entities worth pursuing** and a basis for **prioritizing** them (Discovery half),
- track **contact and interaction** until **interest** is detected and the entity is **qualified** (Engagement half),
- hand a **qualified `Lead`** to the Core value chain, with full lineage.

> **What this module is NOT** (binding): it is **not** a CRM, **not** a marketing-automation platform, **not** a scraper of third-party data, and **not** a pricing/proposal tool (that is Proposal Generation, #1). It does **not** send anything automatically and does **not** introduce a universal "prospect/relationship" entity into the Core (see §4 and ADR-001).

> **Scope note (mission).** Building this module does **not** redefine the mission and does **not** establish a root entity. It is incremental validation of the acquisition funnel for Tenant 0.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates to it |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Everything is an Event* (deliberate discovery/engagement decisions are events; live pipeline is a read-model); *Auditability by Default*; *Policy before Agent* (any future discovery agent acts within policy — relevant to the privacy flag, §12); *Generic Core, Specific Tenants* (Module, not Core — §4); *Simplicity First* (no CRM). |
| **[Identity](../../docs/identity.md)** | Litmus test (§6 there): turning unknown external parties into qualified leads is *a reusable solution to a class of pain* → a **Module**. Serves the human goal (return the founder's attention from prospecting drudgery to judgment). |
| **[Domain Model](../../docs/domain-model.md)** | **Populates** the Core `Lead` aggregate (Commercial context). Adds **no** new Core bounded context. The `Lead` lifecycle (created → qualified) stays Core. |
| **[Spec 002 — Proposal Generation](../002-proposal-generation/spec.md)** | Upstream of it: this module produces the qualified `Lead` that Proposal Generation §1 explicitly requires and explicitly does *not* generate. Clean handoff via the Core `Lead`. |
| **[ADR-001](../../governance/decisions/ADR-001-defer-root-entity-selection.md)** | Binding constraint: this module must **not** introduce a universal root/relationship entity into the Core. Tenant-type specializations (Lead / Contributor / Volunteer / Member / Collaborator) are a Tenant/Module concern, never a Core abstraction. |
| **[Modeling observation](../../blueprints/modeling-observation-transformations-vs-capabilities.md)** | Source of the open boundary in §11: distinguishes the **transformation** (unknown → known → interested → qualified) from the **capability** (the mechanism, which varies per tenant). The four-tenant test is the validity check applied in §11. |

---

## 3. Goals

1. Make sure **no opportunity is silently dropped** before it reaches the value chain.
2. Give the founder a **prioritized**, auditable view of who is worth pursuing.
3. Track **engagement** until interest is real, then hand a **qualified `Lead`** to Core cleanly.
4. Keep every discovery/engagement decision **auditable** with lineage.
5. Work from **manual or mock, tenant-scoped data** in this phase (no integrations, no scraping, no PII).
6. **Honor the open boundary (§11):** build so that, if Discovery and Engagement later split into two contexts, the split is cheap.

---

## 4. Core / Module / Tenant split

### Lives in the **Core** (generic — reused, not defined here)
- The **`Lead` aggregate** and its lifecycle (created → qualified → converted/discarded) — Commercial context.
- The **event substrate**: append-only Audit Log, lineage, tenant isolation.
- Core value-chain events this module produces: **`LeadCreated`**, **`LeadQualified`**.
- The **policy engine** (Phase 3) that will govern any future discovery agent (privacy, contact rules).

### Lives in the **Module** (Opportunity Discovery — defined here)
- The **Discovery** concepts: a recorded candidate entity and a **prioritization** basis (score/ranking logic; thresholds tenant-injected).
- The **Engagement / Qualification** concepts: contact and interaction tracking, **interest detection**, and the qualification act that produces a Core `Lead`.
- The **module events** (§6) for deliberate discovery/engagement decisions.
- (Future) a **discovery agent** under policy — out of v0.

### Lives in the **Tenant** (Tenant 0 — specific, NOT here)
- The actual **entities, contact data, interaction content** (PII — never in the Core, never in VC).
- **Prioritization thresholds**, contact cadence, what "qualified" means for this tenant.
- The **decision to enable** the module, and which half (Discovery, Engagement, or both) it uses.

> **Anti-overfitting (Principle 10):** the tenant-type specializations — commercial `Lead`, OSS `Contributor Prospect`, NGO `Volunteer Prospect`, community `Member Prospect`, creative `Collaborator Prospect` — are **tenant/module realizations of the same transformation**, never Core entities. The Core only ever sees a `Lead` (for tenants that use the Commercial chain); other tenant types map the qualified outcome into their own value chain.

---

## 5. Domain concepts (conceptual — no schema)

- **Candidate Entity** *(Discovery)* — an external party recorded as worth evaluating. Carries a label and a prioritization basis. No PII beyond what the tenant supplies; standalone and manual in this phase.
- **Prioritization** *(Discovery)* — generic ranking logic; thresholds tenant-injected. Selecting what to pursue is auditable.
- **Engagement** *(Engagement/Qualification)* — the record of contact and interaction with a candidate, up to **interest detection**.
- **Qualification** *(Engagement/Qualification)* — the act that converts an engaged, interested candidate into a Core **qualified `Lead`**.

> The four concepts above split cleanly along the **§11 open boundary**. They are specified together in this module **for now**; the split into two contexts is the open decision.

---

## 6. Events vs. read-model

The live pipeline (who is where in discovery/engagement) is a **read-model**, recomputed from the stream, emitting nothing on recompute. Events are emitted only for auditable **facts or human decisions**.

### Candidate module events (subject to the §11 boundary — names provisional)

| Event | Half | Emitted when | Why it earns an event |
|---|---|---|---|
| `EntityDiscovered` | Discovery | A candidate entity is recorded. | The origin of a pursuit; auditable. |
| `EntityPrioritized` | Discovery | A candidate is scored/ranked for pursuit. | A deliberate selection decision. |
| `ContactInitiated` | Engagement | First outreach to a candidate. | A deliberate act with privacy/consent weight (§12). |
| `InterestDetected` | Engagement | A real interest signal is observed. | A material change toward qualification. |
| `LeadQualified` *(Core)* | handoff | The candidate becomes a qualified Core `Lead`. | The Module → Core handoff; produced via the Core event. |

> **Granularity caveat (Event Storming discipline, Brandolini).** Some funnel steps (e.g. "interaction started") are **activities/commands, not domain facts** — they do not necessarily earn an event. The set above is provisional; the **pivotal events** are `EntityDiscovered`, `InterestDetected`, and the Core `LeadQualified`. Final event set is settled at implementation, not here.

---

## 7. User stories

- **US-1 — Record a candidate.** As a founder, I want to record an entity worth pursuing, so that it is not lost.
- **US-2 — Prioritize.** As a founder, I want candidates ranked by a tenant-defined basis, so that I spend attention where it pays off.
- **US-3 — Track engagement.** As a founder, I want to track contact and interaction, so that I know the state of each pursuit.
- **US-4 — Detect interest and qualify.** As a founder, I want to mark a candidate as interested and qualify it, so that a clean qualified `Lead` enters the value chain.
- **US-5 — Audit the funnel.** As a founder/steward, I want every discovery/engagement decision traceable, so that I can trust and reconstruct how a `Lead` originated.

---

## 8. Acceptance criteria (provisional — gated on §11)

**AC-1 (US-1):** *Given* a candidate, *when* recorded, *then* `EntityDiscovered` is emitted (tenant-scoped, with lineage) and it appears in the pipeline read-model.

**AC-2 (US-2):** *Given* candidates with a tenant-defined basis, *when* prioritized, *then* `EntityPrioritized` is recorded and ranking is reconstructable by replay.

**AC-3 (US-3):** *Given* a prioritized candidate, *when* contacted/interacted with, *then* engagement state is tracked auditable, with no double-counting of the same act.

**AC-4 (US-4 — handoff):** *Given* an engaged, interested candidate, *when* qualified, *then* the Core `LeadCreated`/`LeadQualified` are emitted and a qualified `Lead` exists for Proposal Generation to consume. The module introduces **no** Core entity beyond `Lead`.

**AC-5 (US-5 — auditability):** *Given* any module event, *then* it carries tenant, actor, cause, and (where governed) policy, appended immutably; replay reconstructs the pipeline.

**AC-6 (isolation):** *Given* two tenants, *then* each sees only its own candidates; no cross-tenant leakage.

---

## 9. Non-goals (binding)

- **Not** a CRM, marketing-automation, or outreach-sending tool.
- **No** third-party data scraping or enrichment from external sources.
- **No** universal "prospect / relationship" entity in the Core (ADR-001).
- **No** pricing/proposal logic (that is #1).
- **No** automated contact, no agent in v0 (a future, policy-governed agent is a separate spec).
- **No** PII in the Core or in version control; **no** real contact data in this phase.
- **No** UI, API, schema, or code in this spec (spec-first).

---

## 10. Risks

- **R1 — Premature context split.** Splitting Discovery and Engagement now (no usage evidence) is over-engineering. *Mitigation:* one module, §11 boundary documented; split on evidence.
- **R2 — False generalization.** The transformation (unknown → qualified) is **not** uniform across tenant types — for community/creative tenants it is *emergent belonging*, not *discrete qualification*. *Mitigation:* §11 four-tenant test; do not elevate a tenant-shaped transition as generic.
- **R3 — Privacy / PII.** Recording "external unknown entities" is collection of personal data. **Edge case for legal review — see §12.**
- **R4 — Boundary creep into Core.** Pressure to add a relationship root. *Mitigation:* ADR-001 binding; such a move needs its own ADR.

---

## 11. ⚠️ Open decision — is this one bounded context or two?

**Unresolved, deliberately.** The capability splits along a real seam:

- **Discovery** — selection problem (find / evaluate / prioritize). Language: universe, segment, score, priority. Invariant: evaluation completeness + auditable ranking. Cheap to get wrong. **Optional per tenant** (near-absent for inbound-dominant tenants).
- **Engagement / Qualification** — relationship problem (contact / interact / detect interest / qualify). Language: contact, interaction, interest, qualification. Invariant: interaction integrity + consent. Expensive to get wrong. **Near-universal across tenants.**

A second seam sits **inside** Engagement: **discrete qualification** (commercial, NGO — a terminal qualification event) vs **emergent belonging** (community, creative — no terminal event; the relationship accretes from sustained signal).

**Four-tenant test** (per the [modeling observation](../../blueprints/modeling-observation-transformations-vs-capabilities.md)):

| Tenant | Discovery | Engagement shape |
|---|---|---|
| Commercial | full | discrete (→ Lead) |
| NGO | weak | discrete (→ Volunteer Candidate) |
| Community | ~none | **emergent** (→ Member) |
| Creative | curation, not search | **emergent** (→ Collaborator) |

**Decision rule:** keep Discovery + Engagement in **one module for v0**, with this seam documented. **Split into two contexts only when** a real tenant makes the models diverge — e.g. the first inbound/community tenant where belonging is derived from sustained behavior with no qualification gate. Settled by implementation + a second tenant, **not** by further modeling (ADR-001).

**Naming debt:** "Opportunity Discovery" names the *less* universal half (Discovery). If Engagement proves the troncal capability, renaming the module is a **canon change → its own ADR**. Recorded, not actioned.

---

## 12. 🚩 Privacy / compliance flag (must resolve before build)

Recording "external unknown entities," contact, and interaction is **personal-data processing**. For Entel and Chilean context this engages **Ley 19.628** (and its reinforced successor regime) and internal data-handling policy. **Before any implementation:** define lawful basis, data minimization, consent, and retention. This is a **compliance gate**, not a modeling detail, and must **escalate to legal/privacy**. Until resolved, only mock/synthetic data is permitted, and `.data/` stays gitignored.

---

## 13. Out of scope for Phase 0 (what comes next, not now)

- Implementation of any kind. Per [Roadmap](../../docs/roadmap.md), Opportunity Discovery is **Phase 2** (earliest buildable) and depends on the **Workflow engine** for its orchestrated form.
- Resolving the §11 boundary (settled by evidence, not now).
- Any discovery **agent** (needs Agent runtime, Phase 4 — separate spec).
- Tax & Compliance Guard (#4), Administrative Shield (#5).
- This spec does not authorize building — it authorizes review/ratification and a Phase 2 implementation plan once the §12 privacy gate is cleared.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Identity](../../docs/identity.md), and [ADR-001](../../governance/decisions/ADR-001-defer-root-entity-selection.md). Module of origin: [Tenant 0](../../blueprints/tenants/tenant-0-founder-profile.md). Spec-first, conceptual only — with one boundary deliberately left open.*
