# Architecture Review 001 — Daedalus

**Status:** Review · advisory · no code changes  
**Date:** 2026-06-13  
**Reviewer:** ChatGPT  
**Scope:** foundational documents, roadmap, event catalog, domain model, Spec 001, Spec 002  
**Target branch:** `002-proposal-generation`

---

## Executive Summary

Daedalus is currently in a healthy architectural state for a Phase 0 / early Phase 1 project. The most important boundaries are present and mostly consistent:

- Daedalus is a **platform**, not a company.
- Tenant 0 is a **validation case**, not the definition of the system.
- The Core / Modules / Tenants split is explicit and useful.
- The Constitution gives strong constraints around policy, auditability, human governance, and tenant isolation.
- Proposal Generation is a reasonable first operational module because it creates practical value without requiring the full workflow/policy/agent stack.

The main risk is not implementation. The main risk is **conceptual narrowing**: the current Core is strongly shaped around the commercial consulting value chain:

```text
Lead → Proposal → Approval → Project → Delivery → Invoice → Payment
```

That chain is useful and valid as the first validation workflow. It should not silently become the universal ontology of Daedalus.

The recommendation is **not** to refactor the project now. Instead, keep building Proposal Generation v0, but add explicit architectural guardrails so future work can distinguish between:

1. Daedalus as a generic autonomous-organization platform.
2. The first commercial workflow used to validate it.
3. Tenant 0's specific founder use case.

---

## Review Question

> If the consulting/commercial use case disappeared tomorrow, would Daedalus still make architectural sense?

Current answer: **mostly yes, but with caveats.**

The Constitution and Identity survive. The three-layer architecture survives. The event and domain model are more fragile because the Core currently assumes a commercial progression as the first and only concrete chain.

This is acceptable for now, provided the repo explicitly records that the commercial chain is a **reference workflow**, not the permanent root model.

---

## Severity: High

### H1 — The Core may be over-centered on a commercial consulting lifecycle

**Observation**

The Domain Model defines the initial Core around `Lead`, `Proposal`, `Project`, `Invoice`, and `Payment`. The README also frames the Core's first value chain as:

```text
Lead → Proposal → Approval → Project → Delivery → Invoice → Payment
```

That is coherent for Tenant 0 if the first validation case is independent consulting or service delivery. It is less obviously universal for:

- a product/SaaS venture,
- an NGO,
- a creative studio,
- a research project,
- a community initiative,
- an internal automation platform,
- a non-commercial mission.

**Risk**

The project may claim to be an autonomous-organization platform while actually becoming a well-governed consulting-company operating system.

**Recommendation**

Do not remove the commercial chain. Instead, reclassify it in language as the **first reference workflow** or **first validation value chain**, not the root ontology of Daedalus.

Suggested wording to add to `docs/domain-model.md` or `docs/identity.md`:

```text
The Lead → Payment chain is the first reference workflow used to validate the platform through Tenant 0. It is not assumed to be the universal lifecycle of every organization Daedalus may operate.
```

**Decision needed**

Accept this framing before implementation of Phase 1. This does not block Proposal Generation v0, but it should be recorded.

---

### H2 — The fundamental unit remains intentionally unresolved; this should be made explicit as an ADR

**Observation**

The roadmap correctly states that the module sequence does not establish the system's root/fundamental entity. This is a good clarification. However, the open question is important enough to deserve a formal decision record.

Candidate root concepts discussed so far include:

- `Lead`
- `Opportunity`
- `Project`
- `Venture`
- `Initiative`
- `Goal`
- `Intention`

The current model proceeds without choosing one.

**Risk**

Future specs may accidentally choose the root entity implicitly by adding more commercial-specific Core concepts.

**Recommendation**

Add an ADR under `governance/decisions/` documenting:

- The project is deliberately not choosing a universal root entity yet.
- The commercial chain is a validation path, not a final ontology.
- The decision will be revisited after Proposal Generation + Revenue Visibility generate real usage evidence.

Possible ADR title:

```text
governance/decisions/ADR-001-defer-root-entity-selection.md
```

**Decision needed**

Recommended before `/plan` for Proposal Generation, but not strictly blocking.

---

## Severity: Medium

### M1 — Proposal Generation is correctly scoped, but it can still pull the platform toward sales-first thinking

**Observation**

Spec 002 does a good job constraining Proposal Generation:

- not lead generation,
- not CRM,
- not automated sending,
- not contract execution,
- not mandatory AI,
- not a pricing engine.

This is strong scope control.

**Risk**

Because it is the first operational module, Proposal Generation may become psychologically overloaded as "the first real Daedalus capability." That may bias subsequent models toward commercial service delivery.

**Recommendation**

Keep Spec 002, but add a short section called something like:

```text
Architectural Interpretation
```

Suggested content:

```text
Proposal Generation validates Daedalus's ability to transform a governed input into an auditable external artifact. The commercial proposal is the first artifact type, not the only future artifact type. Future tenants may use the same platform pattern to generate grants, project briefs, product specs, research plans, campaign plans, or operational playbooks.
```

This preserves the practical module while connecting it to the broader platform thesis.

---

### M2 — `LeadQualified` is a hidden prerequisite for Proposal Generation v0

**Observation**

Spec 002 assumes a `Lead` already exists and is `qualified`. That is valid. But in practice, if Phase 1 begins with Proposal Generation, the system needs a minimal way to create/qualify a lead manually before the module can run.

**Risk**

Implementation may drift into building CRM-lite functionality unintentionally.

**Recommendation**

For v0, explicitly define the prerequisite as a **manual seed fixture / manual Core command** rather than expanding scope:

```text
Proposal Generation v0 requires a manually created, manually qualified Lead. Lead capture and qualification UX are not part of this module.
```

This protects the module boundary.

---

### M3 — `expected value` crosses Module/Core boundaries and needs a minimal contract

**Observation**

Spec 002 correctly flags that `ProposalGenerated` may need to carry expected value so Revenue Visibility can consume it. This is the first real cross-module composition point.

**Risk**

If expected value is handled ad hoc, Revenue Visibility and Proposal Generation may couple through hidden assumptions.

**Recommendation**

Define the minimal conceptual event contract before implementation:

```text
ProposalGenerated includes an optional expected_value object with amount and currency, if the originating module supplied pricing line items.
```

Do not create a pricing engine. Do not model tax. Just define the minimal payload contract needed for module composition.

---

### M4 — Administrative Shield still reads like a cross-cutting concern, not a normal module

**Observation**

The Domain Model already flags this. Administrative Shield "intercepts admin across the whole chain," which sounds more like a governance/agent experience layer than a domain module.

**Risk**

Later, Administrative Shield may become a vague catch-all for everything unpleasant, weakening module boundaries.

**Recommendation**

Keep it deferred. When revisited, decide whether it is:

1. a module,
2. a workflow/agent pattern,
3. a user-facing operating mode,
4. or a governance concern.

No action needed now.

---

## Severity: Low

### L1 — README thesis is slightly narrower than the emerging project ambition

**Observation**

The README thesis currently focuses on "builders, architects, and technical founders." This matches Tenant 0 well. It may understate the future platform's applicability to small businesses, NGOs, creative organizations, and non-technical operators.

**Recommendation**

No immediate change required. Later, consider a broader thesis:

```text
Daedalus exists to help people and organizations transform intentions into governed, auditable, real-world outcomes without being trapped by administrative friction.
```

Do not make this change now unless the team wants to reopen identity work.

---

### L2 — `Revenue Visibility` should remain second, but avoid over-modeling finance early

**Observation**

Revenue Visibility is valuable after proposals/deals exist. It should stay second in validation priority.

**Recommendation**

When implementation reaches Spec 001, keep it as approximate visibility, not accounting. Do not introduce official bookkeeping, tax, bank integrations, or multi-currency unless forced by usage.

---

## Recommended Actions

### Do now

1. Keep the current architecture.
2. Keep `Spec 002 — Proposal Generation` as the first operational module.
3. Do not reopen the full mission/identity debate.
4. Before implementation, add one ADR deferring the root-entity decision.
5. Add one clarification that the Lead → Payment chain is the first reference workflow, not the universal Daedalus ontology.

### Do during Proposal Generation `/plan`

1. Protect the module from becoming CRM-lite.
2. Define the minimal prerequisite for a qualified lead.
3. Define the minimal `expected_value` contract for `ProposalGenerated`.
4. Keep AI drafting out of v0 unless explicitly introduced as a later enhancement.

### Do later

1. Revisit the root entity after Proposal Generation and Revenue Visibility have produced real usage evidence.
2. Test genericity with a second non-consulting tenant before claiming the platform thesis is proven.
3. Reassess whether `Initiative`, `Venture`, `Goal`, or `Intention` should become a higher-level Core concept.

---

## Do Not Change Now

- Do not rewrite the Constitution.
- Do not replace the Core / Modules / Tenants model.
- Do not deprecate Revenue Visibility.
- Do not collapse Proposal Generation into Opportunity Discovery.
- Do not make agents mandatory for v0.
- Do not introduce tax/compliance implementation yet.
- Do not model every possible organization type before building.

---

## Final Recommendation

Proceed with Proposal Generation v0.

The architecture is good enough to start learning through implementation. The correct next move is not another conceptual refactor; it is a small, bounded implementation cycle that preserves the current guardrails while generating real evidence.

The core architectural warning is simple:

> Treat `Lead → Proposal → Project → Invoice → Payment` as the first validation workflow, not as the final definition of Daedalus.
