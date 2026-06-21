# Spec 009 — Policy Engine (Core capability)

**Status:** Draft · **STUB** (architectural Phase 3 capability) · unlocks [Spec 004](../004-tax-compliance-guard/spec.md) B2
**Type:** Core capability specification (platform substrate — not a Module)
**Owner:** Stewards
**Validation priority:** Phase 3 (per [Roadmap](../../docs/roadmap.md#phase-3--policy-engine))
**Version:** 0.1.0
**Last updated:** 2026-06-21

> **Method.** Spec-first (Constitution, Principle 8). **This is a stub**, mirroring [Spec 004's own pattern](../004-tax-compliance-guard/spec.md): frames the problem, fixes the boundary, records the blockers, does **not** design the mechanism in detail. Writing the full spec now would require architectural choices that should be made with evidence from Phase 2 (Workflow Engine) and at least one governed use case — not by more modeling.

---

## 1. Why this is a stub and not a spec yet

[Spec 004](../004-tax-compliance-guard/spec.md) B2 names this capability as a blocker: *"Policy engine (Phase 3). Must exist; this module is policy-shaped."* [Roadmap Phase 3](../../docs/roadmap.md#phase-3--policy-engine) confirms the policy engine is a platform-level capability whose full design depends on:

1. **Workflow Engine (Phase 2) being exercised in production** — policies gate workflow transitions; we cannot finalize policy semantics without real workflows to gate.
2. **At least one governed use case with a real ambiguity** — Default-deny and escalation must be designed against a real failure mode, not a hypothesized one.
3. **Tax & Compliance Guard's concrete obligations** (depends on [Spec 008](../008-jurisdiction-model/spec.md)) — the first policy-shaped module will stress-test the engine.

Stubbing is consistent with [ADR-001](../../governance/decisions/ADR-001-defer-root-entity-selection.md): prefer evidence over premature modeling.

## 2. Problem framing (the durable part)

Constitution Article II and Article IV require:
- **Policy before Agent** (Principle 2): agents execute within policy; an agent never defines behavior.
- **Default Deny** (§II.3): where authority is unclear, the system denies and escalates.
- **Agent MUST NOT**: define/modify/reinterpret policy; take irreversible action without an authorizing policy; act outside tenant scope; act without traceable lineage.

Today (Phase 1), these are *social contracts enforced in code review*. The Policy Engine makes them **mechanical**: a governed action does not execute unless the engine evaluates an applicable policy and returns a positive decision, with full lineage recorded.

**The engine is the substrate that converts Principle 2 from "we agreed" to "the system enforces."**

## 3. Intended boundary (Core / Module / Tenant)

- **Core:** the **Policy Engine** itself — policy artifact shape, evaluation semantics, decision recording, escalation wiring. Generic across all tenants and all governed domains.
- **Module:** **policy bundles** for a specific concern (e.g. `tax-compliance-policy` consumed by Module #4; later, `irreversible-action-policy`, `cross-tenant-policy`, etc.). A Module declares the policies it depends on; the Tenant selects which Modules are active.
- **Tenant:** **policy parameters** — thresholds, allow/deny lists, jurisdiction-specific values referenced *by name* from policy bundles. **Never** the policy logic itself.

This split is what keeps the Core generic (Principle 10) and lets each Tenant be governed according to its own parameters without the Core knowing those parameters.

## 4. What the engine MUST do (binding, even at stub level)

- **Evaluate a policy against an action context** and return one of: `allow`, `deny`, `escalate(humanGateRef)`. No other outcomes.
- **Default to `escalate`** when no policy matches (Constitution §II.3, default-deny).
- **Record every decision** as a `PolicyDecisionRecorded` event with full lineage: which policy was evaluated, against which action, by which actor, what inputs were considered, what the outcome was, and (for `escalate`) which human gate is awaiting decision.
- **Be auditable end to end**: given a governed action, we can replay the decision tree from events alone.
- **Be tenant-scoped**: a policy for Tenant A cannot be evaluated against an action for Tenant B.
- **Be versioned**: policies are versioned artifacts; an evaluation references the exact version evaluated, never "latest".

## 5. What the engine MUST NOT do

- **Modify a policy** at evaluation time. Policies are immutable per version. New versions replace by reference; old versions remain in the audit trail.
- **Skip evaluation.** A governed action without a recorded `PolicyDecisionRecorded` is illegitimate and must not execute.
- **Invent outcomes** beyond `allow` / `deny` / `escalate`. A "soft allow" or "warn but proceed" is **not** an engine outcome; it is an event the policy can emit while still returning one of the three.
- **Cross tenant boundaries.** The engine's resolution is always `(tenantId, policyRef, version, actionContext)`.

## 6. Blockers (must clear before a full spec)

| # | Blocker | Owner |
|---|---|---|
| **P1** | **Workflow Engine (Phase 2) shipped.** Need a real workflow to gate, not a synthetic one. | Platform roadmap |
| **P2** | **First governed use case.** Tax & Compliance Guard (#4) is the canonical candidate; its `ObligationMissed` event needs a policy that decides whether to flag, escalate, or block. | Module #4 |
| **P3** | **Policy artifact format.** How a policy is expressed — declarative data (JSON/YAML), a small DSL, or a typed function set. Decision must follow evidence from P1 + P2. **No DSL until evidence demands it** (Simplicity First, Technical Principles §5). | Stewards |
| **P4** | **Escalation surface.** Where `escalate(humanGateRef)` lands — currently the operator (CLI/ATLAS). Multi-channel escalation is out of scope until P1 lands. | Platform roadmap |
| **P5** | **Policy authorship tooling.** Who writes policies, how they are reviewed, how versions are bumped. (Constitution §V keeps humans accountable for policies.) | Stewards + legal/tax when tax is in scope |

## 7. Out of scope for now

- A full spec, design, or implementation.
- A DSL.
- An agent runtime (Phase 4) — the engine is independent of *who* is asking.
- Multi-policy conflict resolution (the first version of the engine evaluates one policy per action; "policy bundle" semantics are deferred).
- Policy marketplace, policy inheritance, policy-as-code-for-non-developers.

## 8. Open questions for humans

- **Q1.** Is `escalate` a *terminal* outcome (action waits for human decision) or a *non-terminal* outcome (action proceeds with an audit trail)? Constitution §II.3 reads as terminal; this should be confirmed.
- **Q2.** Should the engine emit a `PolicyEvaluated` event for `allow` outcomes (audit), or only for `deny`/`escalate`? Auditability by Default (Principle 4) suggests yes for all — but volume vs. signal is a real concern.
- **Q3.** Policy authoring — is a TypeScript module (typed, version-controlled, peer-reviewed like any Core change) acceptable as the first format, with declarative JSON later if needed? Ponytail mode says yes by default.

## 9. Conformance when designed (preview)

- ✅ Engine has zero opinion about *which* policies exist; only about evaluation mechanics.
- ✅ Every governed action's audit trail can be replayed to derive the exact policy decision.
- ✅ A tenant can swap a Module's policy bundle for its own without Core changes (Constitution Principle 10).
- ✅ `escalate` *never* auto-resolves. Time has no opinion.

## 10. Relation to canon

| Reference | Conformance |
|---|---|
| [Constitution Principle 2](../../memory/constitution.md) | This engine *is* the mechanical form of "Policy before Agent". |
| [Constitution §II.3](../../memory/constitution.md) | Default-deny is an evaluation primitive, not a convention. |
| [Constitution Article IV](../../memory/constitution.md) | Agent limitations become mechanically enforced at this layer. |
| [Roadmap Phase 3](../../docs/roadmap.md#phase-3--policy-engine) | This spec *is* the Phase 3 capability. |
| [Spec 004](../004-tax-compliance-guard/spec.md) | First consumer of this engine (its B2). |
| [Spec 008](../008-jurisdiction-model/spec.md) | Provides the obligation shape that the tax-compliance policy bundle will consume. |

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Roadmap](../../docs/roadmap.md). Stub only — Phase 3 capability, design follows evidence from Phase 2 workflows.*