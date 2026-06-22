# Tasks — Policy Engine (Phase 3)

**Status:** v1 **SHIPPED** — Spec 009 v1.0.0 + Plan 009 v1.0.0 + 20 tasks ✅ (impl PR #38, branch `034-spec009-policy-engine-implementation`).
**Derives from:** [Spec 009](./spec.md) + [Plan 009](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-jurisdiction-model/spec.md) (mirrors provenance + env-var patterns)
**Version:** 1.1.0
**Last updated:** 2026-06-22

> Tasks map to Spec 009 acceptance criteria and Plan 009 build steps. v1 is shipped; Spec 004's B2 row marked closed.

---

## Phase A — Types and ports ✅

| ID | Task | Status |
|---|---|---|
| P-01 | `PolicyProvenance` type | ✅ |
| P-02 | `Policy` / `PolicyRef` / `PolicyRule` / `PolicyOutcome` / `PolicyMatch` types | ✅ |
| P-03 | `PolicyDecision` (3-outcome) + `PolicyDecisionRecorded` event | ✅ |
| P-04 | `PolicyEnginePort` interface + `PolicyAction` | ✅ |
| P-05 | `PolicyStorePort` interface + error classes | ✅ |

## Phase B — Pure functions + use case ✅

| ID | Task | Status |
|---|---|---|
| P-06 | `validatePolicyProvenance` | ✅ |
| P-07 | `defaultEvaluate` (first-match-wins) | ✅ |
| P-08 | `evaluateAndRecordPolicy` use case | ✅ |

## Phase C — Adapters ✅

| ID | Task | Status |
|---|---|---|
| P-09 | `InMemoryPolicyStore` | ✅ |
| P-10 | `FilesystemPolicyStore` | ✅ |
| P-11 | `packages/core/src/adapters/index.ts` barrel updated | ✅ |

## Phase D — Tenant layer ✅

| ID | Task | Status |
|---|---|---|
| P-12 | `config/policies/tenant-0/` README | ✅ |
| P-13 | `config/policies/` root + `.gitkeep` | ✅ |
| P-14 | No tenant-0 policy file in this phase (founder's task) | ⏭️ (intentional non-task) |

## Phase E — Conformance & tests ✅

| ID | Task | Status |
|---|---|---|
| P-15 | `tests/policy-engine.test.ts` — 8 cases | ✅ |
| P-16 | `scripts/check-policies-have-provenance.mjs` wired into `npm test` | ✅ |

## Phase F — Documentation & index updates ✅

| ID | Task | Status |
|---|---|---|
| P-17 | `packages/core/src/index.ts` curated contract | ✅ |
| P-18 | `docs/identity.md` records "Policy before Agent" is now mechanical | ✅ |
| P-19 | Spec 004 §4 B2 marked ✅ Closed | ✅ |
| P-20 | (Roadmap not edited — Phase 3 capability is reflected via Spec 004 + Spec 009 itself) | ⏭️ (intentional skip) |

---

## Done criteria (all met)

- ✅ `npm test` is green (138 → **146 tests** + 3 lint scripts).
- ✅ Adding a policy JSON without `provenance` causes `npm test` to fail.
- ✅ A governed action's audit trail can be replayed to derive the exact policy decision.
- ✅ A tenant can supply its own policy JSON without Core changes (Principle 10).
- ✅ `escalate` is terminal — the engine never resolves it; the caller decides.
- ✅ The Core stays generic; Modules own policies; Tenants own parameters.
- ✅ The Workflow Engine's `PolicyDecisionPort` is unchanged in this PR; integration is a future Spec.

## Out of scope (still)

- A policy DSL (Spec 009 §13).
- A policy marketplace, policy inheritance, policy composition.
- An agent runtime (Phase 4).
- Multi-channel escalation.
- Policy authorship tooling.
- Integration with the Workflow Engine's `PolicyDecisionPort` (separate Spec).
- A tax-compliance-policy bundle (the first real consumer) — authored by Spec 004 when it ships."