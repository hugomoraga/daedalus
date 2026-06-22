# Plan 009 — Policy Engine (Phase 3)

**Status:** Ratified · implementation plan for [Spec 009](./spec.md) v1.0.0
**Derives from:** [Spec 009](./spec.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-jurisdiction-model/spec.md) (mirrors provenance + env-var patterns)
**Version:** 1.0.0
**Last updated:** 2026-06-21

> The `/plan` step for the Policy Engine. The engine lives in `packages/core/src/{domain,application,adapters}/policy/` — small enough that a new package would be premature. **Ports earn their place**: `PolicyStorePort` earns a place because the spec contemplates ≥2 implementations (in-memory default + filesystem + future per-tenant source). `PolicyEnginePort` earns a place because Modules may ship custom evaluators (the default evaluator is the v1 fallback). All other types are pure data.

---

## 0. Q resolutions (from Spec 009 §11)

- **Q1 (escalate terminal):** YES, terminal. The action waits.
- **Q2 (emit for all outcomes):** YES — `PolicyDecisionRecorded` for `allow`, `deny`, and `escalate`. Auditable by default.
- **Q3 (policy format):** Declarative JSON. Mirrors the workflow artifact shape.

## 1. Architecture (no new package; lives in `@daedalus/core`)

The Policy Engine is small enough (a handful of types, one port, one use case, one built-in evaluator, one filesystem adapter) that a new package would be premature. The engine ships inside `packages/core` next to the Jurisdiction Model (which shipped in PR #35). The package boundary is the same: `core` exports types + ports + use case via the main entry; concrete adapters via the `./adapters` subpath.

```
packages/core/src/
  domain/policy/
    policy.ts                 # types: PolicyRef, Policy, PolicyRule, PolicyOutcome, PolicyMatch
    policy-provenance.ts      # type: PolicyProvenance (mirrors Spec 008 §3.3)
    policy-decision.ts        # type: PolicyDecision (the 3-outcome verdict)
    policy-decision-recorded.ts # domain event + payload type
  application/policy/
    ports/policy-engine-port.ts    # interface (evaluate)
    ports/policy-store-port.ts     # interface (load) + error classes
    validate-policy-provenance.ts  # pure function (mirrors Spec 008)
    evaluate-policy.ts            # pure function (default evaluator; first-match-wins)
    record-policy-decision.ts      # use case: evaluates + records the event
  adapters/policy/
    in-memory-policy-store.ts      # Map-backed store (tests + Phase 1 default)
    filesystem-policy-store.ts     # reads config/policies/<tenant>/<policyId>@<version>.json
    default-policy-evaluator.ts    # the built-in first-match-wins evaluator
```

**Why no separate package?** Per ADR-003 (modular monorepo): "package boundaries earn their place when there is a non-trivial logic surface that benefits from being a peer to other Core/Module packages." The Policy Engine's surface is ~10 source files — well under the threshold for a peer package. If a future Spec grows it (e.g. a per-tenant DSL, marketplace, multi-policy composition), extracting it to `@daedalus/policy-engine` is a mechanical move (mirrors the Workflow Engine extraction precedent).

## 2. The default evaluator (Spec 009 §7) — first-match-wins

```ts
function defaultEvaluate(policy: Policy, action: PolicyAction): PolicyDecision {
  for (const rule of policy.rules) {
    if (matches(rule.match, action)) {
      if (rule.outcome === "escalate") {
        return { kind: "escalate", gateRef: rule.escalateTo ?? "default", reason: rule.reason ?? "rule-matched-escalate" };
      }
      if (rule.outcome === "deny") {
        return { kind: "deny", reason: rule.reason ?? "rule-matched-deny" };
      }
      return { kind: "allow", reason: rule.reason };
    }
  }
  // No rule matched → default-deny (Constitution §II.3)
  return { kind: "escalate", gateRef: "default", reason: "no-rule-matched" };
}
```

Pure function. Stateless. Same input + same policy = same decision. The caller (use case) is responsible for recording the decision via the event store.

## 3. The use case: `evaluateAndRecordPolicy`

The canonical entry point. Loads the policy (via `PolicyStorePort`), runs the default evaluator, records `PolicyDecisionRecorded` via Core's event store, and returns the decision. The caller (Module / Workflow Engine integration) decides what to do with the verdict.

```ts
async function evaluateAndRecordPolicy(
  deps: CoreDeps,
  store: PolicyStorePort,
  input: {
    tenantId: string;
    actor: string;
    policyRef: PolicyRef;
    action: PolicyAction;
  },
): Promise<PolicyDecision> {
  const policy = await store.load(input.policyRef, input.tenantId);
  const decision = defaultEvaluate(policy, input.action);
  const eventId = deps.newId();
  const lineage = startLineage(deps.newId);
  await appendIntents(deps, input.tenantId, [{
    type: PolicyDecisionRecorded,
    payload: {
      policyRef: { policyId: input.policyRef.policyId, version: input.policyRef.version },
      action: { actionType: input.action.actionType, context: input.action.context },
      outcome: decision,
      provenance: policy.provenance,
      ruleId: undefined,  // default evaluator doesn't track which rule fired; future evaluators can
    },
  }], lineage);
  void eventId;
  return decision;
}
```

## 4. Integration with the Workflow Engine (out of scope for this PR)

The Workflow Engine's existing `PolicyDecisionPort` (in `packages/workflow-engine/src/application/ports/policy.ts`) is a **simpler** surface — it returns `{allow: true}` or `{allow: false, reason: string}`. It is the engine's "should this transition need human approval?" check, not a general policy evaluation. The Policy Engine is the richer, audited substrate.

A future Spec will integrate them: the Workflow Engine's `PolicyDecisionPort.decide()` will call the Policy Engine's `evaluateAndRecordPolicy` (passing an action derived from the transition + event + instance), and map the 3-outcome result back to the 2-outcome shape the engine uses today (`escalate` ↔ `deny` ↔ `allow: false` with reason; `allow` ↔ `allow: true`).

**This PR ships the engine. It does NOT wire the engine into the Workflow Engine.** A separate Spec / PR will do that integration, with tests that prove the end-to-end audit trail.

## 5. Policy bundle format (Spec 009 §3.1 + §3.2)

```json
{
  "policyId": "tax-compliance-flag",
  "version": "1.0.0",
  "effectiveFrom": "2026-01-01",
  "provenance": {
    "sourceKind": "tenant-declared",
    "sourceId": "founder-2026-Q1",
    "retrievedAt": "2026-01-01",
    "verifiedBy": "<founder>"
  },
  "rules": [
    {
      "ruleId": "r1",
      "match": { "actionType": "ObligationMissed" },
      "outcome": "escalate",
      "escalateTo": "tax-compliance-review",
      "reason": "missed obligation → founder review"
    },
    {
      "ruleId": "default",
      "match": { "always": true },
      "outcome": "allow",
      "reason": "default allow"
    }
  ]
}
```

Mirrors the workflow artifact shape (`blueprints/workflows/*.json`).

## 6. Test strategy

`tests/policy-engine.test.ts`:

1. Default evaluator: first-match-wins; no-match → `escalate` (default-deny).
2. Rule with `{ always: true }` makes the default explicit.
3. `validatePolicyProvenance` rejects missing fields (mirrors `validateProvenance` from Spec 008).
4. `FilesystemPolicyStore` throws `PolicyNotFound` / `PolicyProvenanceMissing` / `PolicyVersionMismatch` as documented.
5. Two tenants, two policies — zero cross-leak.
6. `evaluateAndRecordPolicy` emits `PolicyDecisionRecorded` with full lineage.
7. Decision is `escalate` (terminal): the engine never resolves it; the caller decides what to do.
8. `InMemoryPolicyStore` round-trips a policy; `FilesystemPolicyStore` reads the same shape from disk.

No fixtures file. Test data is constructed inline.

## 7. Conformance (lint scripts)

A new lint script `scripts/check-policies-have-provenance.mjs` (mirrors `check-rulesets-have-provenance.mjs` from Spec 008) walks `config/policies/**/*.json` and fails the build if any policy's `provenance` is missing a required field. Wired into `npm test`.

The existing `check-core-jurisdiction-agnostic.mjs` from Spec 008 already enforces that no jurisdiction-specific term appears in `packages/core/src/**`. The Policy Engine's types are domain-agnostic, so this lint still passes. (If a future policy engine feature adds a jurisdiction-specific term, the keywords list gets a PR.)

## 8. Definition of done (v1.0)

- `packages/core/src/domain/policy/` exists; the 5 type files compile.
- `packages/core/src/application/policy/` exists; the 5 application files compile.
- `packages/core/src/adapters/policy/` exists; the 3 adapter files compile.
- `packages/core/src/index.ts` exports the curated contract (types + ports + use case + no-op evaluator + `noOpPolicy` for tests).
- `packages/core/src/adapters/index.ts` exports the 3 concrete adapters.
- `tests/policy-engine.test.ts` covers 8 cases (all green).
- `scripts/check-policies-have-provenance.mjs` exists, fails the build on bad provenance, and runs in `npm test`.
- `npm test` is green (138 + ~8 = ~146 tests).
- `npm run lint:core-jurisdiction-agnostic` still passes (Policy Engine adds no jurisdiction terms).
- Workflow Engine's `PolicyDecisionPort` is unchanged in this PR. Integration is a future Spec.

## 9. Out of scope (this PR; forward-planning only)

- A policy DSL (Spec 009 §13).
- A policy marketplace, policy inheritance.
- Multi-policy bundles per action.
- An agent runtime (Phase 4) — the engine is independent of *who* asks.
- Multi-channel escalation.
- Policy authorship tooling (Spec 009 §7 P5).
- Integration with the Workflow Engine's `PolicyDecisionPort` (separate Spec).
- A tax-compliance-policy bundle (the first real consumer) — authored by Spec 004 when it ships.