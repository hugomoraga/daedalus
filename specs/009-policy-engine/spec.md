# Spec 009 — Policy Engine (Phase 3)

**Status:** Ratified · **Phase 3 capability** · platform substrate · build authorized
**Type:** Core capability specification (platform substrate — not a Module; not a Tenant concern)
**Owner:** Stewards
**Validation priority:** Phase 3 (per [Roadmap](../../docs/roadmap.md#phase-3--policy-engine))
**Version:** 1.0.0
**Last updated:** 2026-06-21

> **Method.** Spec-first (Constitution, Principle 8). This v1.0 ratifies the **mechanism** of the Policy Engine (the substrate). It does **not** ratify any specific policy bundle — those are authored by Modules ([Spec 004 Tax & Compliance Guard](../004-tax-compliance-guard/spec.md) is the first consumer) and reviewed under [Constitution §V](../../memory/constitution.md) (human accountability for policy).

> **Upgraded from STUB.** The Workflow Engine (Phase 2) shipped via PRs #26..#30. P1 (Workflow Engine in production) is now ✅ satisfied — there is a real workflow (`lead-to-payment` v0.2.0) with a real human gate (`paid → closed`) for the engine to govern. The remaining open questions (Q1, Q2, Q3 below) are resolved in §11 with the rationale per ADR-001 ("prefer evidence over premature modeling").

---

## 1. Why this exists (Constitution → code)

[Constitution](../../memory/constitution.md) requires:

- **Policy before Agent** (Principle 2): agents execute within policy; an agent never defines behavior.
- **Default Deny** (§II.3): where authority is unclear, the system denies and escalates.
- **Agent MUST NOT** (Article IV): define/modify/reinterpret policy; take irreversible action without an authorizing policy; act outside tenant scope; act without traceable lineage.

Today (Phase 1 + 2), these are **social contracts enforced in code review**. The Policy Engine makes them **mechanical**: a governed action does not execute unless the engine evaluates an applicable policy and returns a positive decision, with full lineage recorded.

**The engine is the substrate that converts Principle 2 from "we agreed" to "the system enforces."**

## 2. Intended boundary (Core / Module / Tenant)

| Layer | What lives here | What does **not** live here |
|---|---|---|
| **Core** | The Policy Engine itself: policy artifact shape (JSON, versioned, tenant-scoped), evaluation semantics (allow / deny / escalate), decision recording (`PolicyDecisionRecorded` event with full lineage), and a default in-memory evaluator. Generic across all tenants and all governed domains. | Any specific policy bundle (those are Modules). Any tenant parameter (those are Tenant). |
| **Module** | Policy bundles for a specific concern — e.g. `tax-compliance-policy` (consumed by [Spec 004](../004-tax-compliance-guard/spec.md)), later `irreversible-action-policy`, `cross-tenant-policy`, etc. A Module declares the policies it depends on; the Tenant selects which Modules are active. | The evaluation mechanism. Policy bundles are **data** consumed by the Core's engine, not code paths. |
| **Tenant** | Policy parameters referenced *by name* from policy bundles — thresholds, allow/deny lists, jurisdiction-specific values. Per Plan §4.1, these flow via `.env` (gitignored), never hardcoded. | Policy logic itself. The Tenant cannot redefine what a policy decides. |

This split is what keeps the Core generic (Constitution Principle 10) and lets each Tenant be governed according to its own parameters without the Core knowing those parameters.

## 3. Concepts

### 3.1 `Policy` (the artifact — a versioned JSON document)

```ts
type PolicyRef = {
  policyId: string;        // stable, opaque
  version: string;          // semver — opaque to engine mechanics
  effectiveFrom: string;     // ISO date
  provenance: PolicyProvenance; // see §3.3
  // Rules are loaded from `rulesUri`; the engine reads the policy file by
  // reference (Core never inlines rules into its code path).
  rulesUri: string;
};
```

A policy's `rulesUri` points to a JSON file (default location: `config/policies/<tenant>/<policyId>@<version>.json`). The file is data, not code. The engine reads it; the engine never edits it.

### 3.2 `PolicyRule` (the shape of a single rule inside a policy)

```ts
type PolicyOutcome = "allow" | "deny" | "escalate";

type PolicyRule = {
  ruleId: string;            // stable within policy+version
  // When the action context matches this rule's `match`, the rule fires
  // and returns its `outcome`. First match wins (rule order matters).
  match: PolicyMatch;
  outcome: PolicyOutcome;
  // For `escalate`: which human gate should the action route to? Opaque
  // string the operator surface knows how to interpret.
  escalateTo?: string;
  // Free-text reason recorded on the PolicyDecisionRecorded event.
  reason?: string;
};

// A `match` is a structured predicate over the action context. v1
// supports:
//   - { actionType: "ObligationMissed" }         — exact match on action kind
//   - { fieldEquals: { field: string, value: unknown } }  — single-field equality
//   - { and: [match, match, ...] }                — conjunction
//   - { or:  [match, match, ...] }                — disjunction
//   - { always: true }                            — catch-all
//
// Richer predicate languages (DSL, regex, etc.) are explicitly future
// (Constitution §Simplicity First; no DSL until evidence demands it).
type PolicyMatch =
  | { actionType: string }
  | { fieldEquals: { field: string; value: unknown } }
  | { and: PolicyMatch[] }
  | { or: PolicyMatch[] }
  | { always: true };
```

### 3.3 `PolicyProvenance` (mandatory)

Every policy MUST carry provenance. Mirrors `RuleProvenance` from [Spec 013](../013-jurisdiction-model/spec.md) §3.3 — same intent (who vouched for this content, when, with what source), same mandatory nature.

```ts
type PolicyProvenance = {
  sourceKind: "official-publication" | "legal-advisor-opinion" | "tenant-declared";
  sourceId: string;
  retrievedAt: string;     // ISO date
  verifiedBy: string;      // human identity (PII — env var in Tenant layer)
  notes?: string;
};
```

The Core validates provenance (via `validatePolicyProvenance` — same shape as `validateProvenance` from Spec 013). A policy without provenance is a hard error.

### 3.4 `PolicyDecision` (the engine's verdict)

```ts
type PolicyDecision =
  | { kind: "allow"; reason?: string }
  | { kind: "deny"; reason: string }
  | { kind: "escalate"; gateRef: string; reason: string };
```

Exactly three outcomes. No "soft allow", "warn but proceed", or other variants (Constitution §II.3 — Default Deny; Constitution §Simplicity First — no cleverer-than-necessary). A policy that wants to surface a non-blocking warning can do so by emitting a side event while still returning one of the three.

## 4. Engine API

```ts
interface PolicyEnginePort {
  // Resolve a policy by (tenantId, policyRef) and return its loaded shape.
  // Throws PolicyNotFound if no policy at rulesUri; throws
  // PolicyProvenanceMissing if any required field is missing.
  loadPolicy(tenantId: string, ref: PolicyRef): Promise<Policy>;

  // Evaluate an action against a policy and return the verdict. Records a
  // PolicyDecisionRecorded event in the tenant's stream (full lineage).
  evaluate(input: {
    tenantId: string;
    actor: string;
    policyRef: PolicyRef;
    action: PolicyAction;
  }): Promise<PolicyDecision>;
}

// The action being evaluated. v1 supports: obligation events from Spec 013
// (ObligationMissed is the canonical first case), and arbitrary action
// shapes via the Module layer (any Module can construct a PolicyAction).
type PolicyAction = {
  actionType: string;     // e.g. "ObligationMissed", "ProjectClosed"
  tenantId: string;
  actor: string;
  context: Record<string, unknown>;
  occurredAt: string;     // ISO date
};
```

The evaluation is **stateless and pure** given the loaded policy. Same input + same policy = same decision. The recording side-effect is the only thing that touches the event store.

## 5. What the engine MUST do (binding)

1. **Evaluate a policy against an action context** and return one of: `allow`, `deny`, `escalate(humanGateRef)`. No other outcomes.
2. **Default to `escalate`** when no rule matches (Constitution §II.3, default-deny). A `match: { always: true }` rule at the end of a policy can be used to make the implicit default explicit (recommended).
3. **Record every decision** as a `PolicyDecisionRecorded` event with full lineage: which policy was evaluated (id + version), against which action (type + context), by which actor, what inputs were considered, what the outcome was, and (for `escalate`) which human gate is awaiting decision.
4. **Be auditable end-to-end**: given a governed action, replaying the event stream must reconstruct the exact decision tree.
5. **Be tenant-scoped**: a policy for Tenant A cannot be evaluated against an action for Tenant B. The engine's resolution is always `(tenantId, policyRef, action)`.
6. **Be versioned**: an evaluation references the exact `(policyId, version)` evaluated, never "latest". Old versions remain in the audit trail.

## 6. What the engine MUST NOT do

- **Modify a policy** at evaluation time. Policies are immutable per version. New versions replace by reference; old versions remain in the audit trail.
- **Skip evaluation.** A governed action without a recorded `PolicyDecisionRecorded` is illegitimate and must not execute. The evaluating caller is responsible for recording the decision before acting.
- **Invent outcomes** beyond `allow` / `deny` / `escalate`. A "soft allow" or "warn but proceed" is **not** an engine outcome; it is an event a policy bundle can emit while still returning one of the three.
- **Cross tenant boundaries.** The engine's resolution is always `(tenantId, policyRef, action)`.
- **Modify rules at evaluation time.** Policies are immutable per version. The engine reads; it does not write.

## 7. Default evaluation (the built-in evaluator)

The engine ships with a **default evaluator** that:

1. Loads the policy by `(tenantId, policyRef.rulesUri)`.
2. Iterates `policy.rules` in order. The first rule whose `match` evaluates true wins.
3. Returns the rule's `outcome`. If no rule matches, returns `escalate` with reason `"no-rule-matched"` (default-deny).
4. The caller is responsible for recording the decision via `PolicyDecisionRecorded`.

The default evaluator is a **fallback**. Modules with complex policies can supply a custom evaluator (the port is an interface, not a sealed implementation). For v1, the default evaluator is sufficient — Spec 004's tax-compliance-policy bundle will be the first real consumer.

## 8. Event: `PolicyDecisionRecorded`

```ts
const PolicyDecisionRecorded = "PolicyDecisionRecorded";

type PolicyDecisionRecordedPayload = {
  policyRef: { policyId: string; version: string };
  action: { actionType: string; context: Record<string, unknown> };
  outcome:
    | { kind: "allow"; reason?: string }
    | { kind: "deny"; reason: string }
    | { kind: "escalate"; gateRef: string; reason: string };
  provenance: PolicyProvenance;
  ruleId?: string;          // which rule fired (null when no-match → default escalate)
};
```

Full lineage per ADR-004: `tenantId`, `actor`, `occurredAt`, `correlationId`, `causationId`, `payload`. The `correlationId` is the workflow instance's correlation when the action originates from a workflow; otherwise a fresh correlation. The `causationId` is the event that triggered the action (e.g. `ObligationMissed`).

## 9. Persistence

The default **policy store** reads from `config/policies/<tenant>/<policyId>@<version>.json` (filesystem-backed; mirrors the [Spec 013 ruleset loader](../013-jurisdiction-model/spec.md) pattern). A tenant can supply its own store by implementing `PolicyStorePort`.

```ts
interface PolicyStorePort {
  load(ref: PolicyRef, tenantId: string): Promise<Policy>;
  // Throws PolicyNotFound if no file at rulesUri.
  // Throws PolicyProvenanceMissing if any required provenance field is missing.
  // Throws PolicyVersionMismatch if version in file != version in ref.
}
```

A test double (`InMemoryPolicyStore`) is shipped for unit tests and Phase 1 default.

## 10. Out of scope (binding for v1)

- **A policy DSL.** Declarative JSON only (per Q3 resolution).
- **A policy marketplace, policy inheritance, or policy-as-code-for-non-developers.** Out of scope until evidence demands them (Constitution Simplicity First).
- **Multi-policy bundles per action.** v1 evaluates ONE policy per action. Module-level "policy composition" (e.g. tax-compliance-policy + irreversible-action-policy) is a future Spec. The caller chooses which policy to evaluate and passes the `PolicyRef`.
- **An agent runtime** (Phase 4). The engine is independent of *who* is asking — a Module, a human, a future agent.
- **Multi-channel escalation** (email, SMS, etc.). v1 escalates to a `gateRef` string; the operator surface (CLI / ATLAS) interprets it. Multi-channel is future.
- **Policy authorship tooling.** Who writes policies, how they are reviewed, how versions are bumped, how a Module declares its dependencies. This is P5 in the stub; deferred to a separate Spec.

## 11. Open questions (resolved in v1.0)

- **Q1 — is `escalate` terminal?** **Yes.** Constitution §II.3 reads as terminal: "deny and escalate" is the system's response to ambiguity; the action waits for human decision. (Q1 closed.)
- **Q2 — does the engine emit a `PolicyDecisionRecorded` for `allow` outcomes?** **Yes — for all outcomes.** Principle 4 (Auditability by Default) demands it. Volume is manageable (append-only JSONL, no query at the event level). (Q2 closed.)
- **Q3 — policy format?** **Declarative JSON**, mirroring the workflow artifact shape. Module authors can produce a JSON file under their package's `policies/` directory; the engine loads it by `rulesUri`. Ponytail mode and the workflow engine precedent both support this default. JSON → typed-DSL migration is a future Spec, not v1. (Q3 closed.)

## 12. Conformance (binding)

- ✅ Engine has zero opinion about *which* policies exist; only about evaluation mechanics.
- ✅ Every governed action's audit trail can be replayed to derive the exact policy decision.
- ✅ A tenant can swap a Module's policy bundle for its own without Core changes (Constitution Principle 10).
- ✅ `escalate` *never* auto-resolves. Time has no opinion. A workflow's `requiresHuman` is a separate concept; the policy engine emits `escalate`, and the caller (Module / Workflow Engine) decides what to do with the `gateRef`.
- ✅ Engine never modifies policies. Policies are immutable per version. (Spec 013 §6 Conformance, mirrored.)
- ✅ `verifiedBy` (PII) never enters git history. Mirrors the Spec 013 env-var pattern: policy provenance is loaded from `.env` (gitignored) at composition time.

## 13. Non-goals (this spec, this version)

- Inventing policies for any tenant. (Same line as Spec 013 §6: "No invented rules.")
- A DSL for policies.
- A "policy marketplace" or policy inheritance.
- Auto-fetching policies from external sources.
- Migration/transition logic between policy versions.
- An agent runtime (Phase 4). The engine is independent of *who* asks.
- Multi-channel escalation.

## 14. Relation to canon

| Reference | Conformance |
|---|---|
| [Constitution Principle 2](../../memory/constitution.md) | This engine *is* the mechanical form of "Policy before Agent". |
| [Constitution §II.3](../../memory/constitution.md) | Default-deny is an evaluation primitive, not a convention. |
| [Constitution Article IV](../../memory/constitution.md) | Agent limitations become mechanically enforced at this layer. |
| [Constitution Principle 4](../../memory/constitution.md) | `PolicyDecisionRecorded` for all outcomes — auditable by default. |
| [Constitution Principle 10](../../memory/constitution.md) | Engine stays generic; Module owns policies; Tenant owns parameters. |
| [Roadmap Phase 3](../../docs/roadmap.md#phase-3--policy-engine) | This spec *is* the Phase 3 capability. |
| [Spec 004](../004-tax-compliance-guard/spec.md) | First consumer of this engine (its B2). The tax-compliance-policy bundle will be the first real consumer. |
| [Spec 013](../013-jurisdiction-model/spec.md) | Provides the obligation shape that the tax-compliance policy bundle will consume. The `verifyProvenance` pattern is mirrored. |
| [Spec 008 — Workflow Engine](../008-workflow-engine/spec.md) | The Workflow Engine's `PolicyDecisionPort` (v0 no-op) is a separate, simpler surface for "should this transition need human approval?" The Policy Engine is the richer, audited substrate. They will be integrated in a future Spec. |
| [ADR-001](../../governance/decisions/ADR-001-defer-root-entity-selection.md) | Open questions resolved based on Phase 2 evidence (engine shipped) + the v0.1 spec's own framing. No premature design. |
| [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md) | `PolicyDecisionRecorded` carries full lineage. The engine respects tenant boundaries structurally. |

---

*Subordinate to the [Constitution](../../memory/constitution.md), the [Roadmap](../../docs/roadmap.md), and [Spec 004](../004-tax-compliance-guard/spec.md) (the first consumer). Platform substrate — Core stays generic; Modules own policies; Tenants own parameters.*