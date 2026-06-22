# Tasks — Policy Engine (Phase 3)

**Status:** Build **authorized** — Spec 009 v1.0.0 + Plan 009 v1.0.0 ratified 2026-06-21 (governance PR #36, branch `033-spec009-policy-engine-ratify-pack`). P-01..P-08 ready to build in branch `034-spec009-policy-engine-implementation`.
**Derives from:** [Spec 009](./spec.md) + [Plan 009](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-jurisdiction-model/spec.md) (mirrors provenance + env-var patterns)
**Version:** 1.0.0
**Last updated:** 2026-06-21

> The `/tasks` step for the Policy Engine. Tasks map 1:1 to Spec 009 acceptance criteria and Plan 009 build steps so progress stays traceable.

---

## Phase A — Types and ports ✅ ready to build

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **P-01** | Define `PolicyProvenance` type (mirrors Spec 008 §3.3). | `packages/core/src/domain/policy/policy-provenance.ts` | §3.3 |
| **P-02** | Define `Policy`, `PolicyRef`, `PolicyRule`, `PolicyOutcome`, `PolicyMatch` types. | `packages/core/src/domain/policy/policy.ts` | §3.1, §3.2 |
| **P-03** | Define `PolicyDecision` (3-outcome) + `PolicyDecisionRecorded` domain event + payload. | `packages/core/src/domain/policy/{policy-decision,policy-decision-recorded}.ts` | §3.4, §8 |
| **P-04** | Define `PolicyEnginePort` interface (`evaluate`) + `PolicyAction` type. | `packages/core/src/application/policy/ports/policy-engine-port.ts` | §4 |
| **P-05** | Define `PolicyStorePort` interface + error classes (`PolicyNotFound`, `PolicyProvenanceMissing`, `PolicyVersionMismatch`). | `packages/core/src/application/policy/ports/policy-store-port.ts` | §9 |

## Phase B — Pure functions + use case

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **P-06** | `validatePolicyProvenance(policy)` — pure function. Mirrors `validateProvenance` from Spec 008. | `packages/core/src/application/policy/validate-policy-provenance.ts` | §12 |
| **P-07** | `defaultEvaluate(policy, action)` — pure function. First-match-wins; no-match → `escalate`. | `packages/core/src/application/policy/default-evaluator.ts` | §7, Plan §2 |
| **P-08** | `evaluateAndRecordPolicy(deps, store, input)` — use case. Loads via store, runs default evaluator, records `PolicyDecisionRecorded` event. | `packages/core/src/application/policy/evaluate-and-record-policy.ts` | Plan §3 |

## Phase C — Adapters

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **P-09** | `InMemoryPolicyStore` — Map-backed. Tests + Phase 1 default. | `packages/core/src/adapters/policy/in-memory-policy-store.ts` | §9 |
| **P-10** | `FilesystemPolicyStore` — reads `config/policies/<tenant>/<policyId>@<version>.json`. Validates provenance + version before returning. | `packages/core/src/adapters/policy/filesystem-policy-store.ts` | §9 |
| **P-11** | Wire adapters into `packages/core/src/adapters/index.ts` (add to existing barrel). | `packages/core/src/adapters/index.ts` (edit) | ADR-004 |

## Phase D — Tenant layer

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **P-12** | `config/policies/tenant-0/.gitkeep` + `README.md` (mirrors `config/rulesets/tenant-0/README.md`). Explains: no policies in repo, founder adds JSON files at the path, env-var pattern for `verifiedBy`. | directory + README | Plan §5 |
| **P-13** | Add `config/policies/` placeholder + `.gitkeep` (root). | directory | Plan §5 |
| **P-14** | No tenant-0 policy file in this phase. Founder's task — follows the same env-var pattern as Spec 008 (per Plan §4.1). | nothing | Plan §1 |

## Phase E — Conformance & tests

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **P-15** | `tests/policy-engine.test.ts` — 8 cases (Plan §6). Uses `node --test`. Test data constructed inline. | test file passing `npm test` | §12, Plan §6 |
| **P-16** | Lint script `scripts/check-policies-have-provenance.mjs` (mirrors `check-rulesets-have-provenance.mjs` from Spec 008). Wired into `npm test`. | script + npm script entry | Plan §7 |

## Phase F — Documentation & index updates

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **P-17** | `packages/core/src/index.ts` — add the curated Policy Engine contract (types + ports + use case + no-op evaluator). | edited index | ADR-004 |
| **P-18** | Update `docs/identity.md` — note that "Policy before Agent" is now mechanically enforced (Phase 3 capability live). | edited doc | §14, Constitution Principle 2 |
| **P-19** | Update `specs/004-tax-compliance-guard/spec.md` §4 — mark B2 (Policy Engine) as ✅ Closed (with link to Spec 009). Net: 2 of 4 unblockers built. | edited spec 004 | §14, Plan §9 |
| **P-20** | Update `docs/roadmap.md` — mark Phase 3 capability as ✅ Built (engine shipped; tax compliance still pending; policy authoring still pending). | edited roadmap | Plan §9 |

## Sequencing

- **Phase A and B are independent** (types and pure functions).
- **Phase C depends on A and B.**
- **Phase D is independent of code** — purely directory + docs.
- **Phase E depends on A, B, C.**
- **Phase F depends on E.**

## Done criteria (v1.0)

- ✅ `npm test` is green (138 + ~8 = ~146 tests, all passing + the existing 2 lint scripts + the new one).
- ✅ Adding a policy JSON without `provenance` causes `npm test` to fail.
- ✅ A governed action's audit trail can be replayed to derive the exact policy decision.
- ✅ A tenant can supply its own policy JSON without Core changes (Principle 10).
- ✅ `escalate` is terminal — the engine never resolves it; the caller decides.
- ✅ No new Core event types beyond `PolicyDecisionRecorded` (mirrors the jurisdiction event approach).
- ✅ The Workflow Engine's `PolicyDecisionPort` is unchanged in this PR; integration is a future Spec.

## Out of scope (this task list)

- A policy DSL (Spec 009 §13).
- A policy marketplace, policy inheritance, policy composition.
- An agent runtime (Phase 4).
- Multi-channel escalation.
- Policy authorship tooling.
- Integration with the Workflow Engine's `PolicyDecisionPort` (separate Spec).
- A tax-compliance-policy bundle (the first real consumer) — authored by Spec 004 when it ships.

## Activation criteria for build (all satisfied)

- ✅ Spec 009 v1.0.0 ratified (this document + spec.md bumped).
- ✅ Plan 009 v1.0.0 ratified (this document + plan.md bumped).
- ✅ Workflow Engine (Phase 2) shipped (PRs #26..#30) — Spec 009 P1 cleared.
- ✅ Spec 008-jurisdiction shipped (PR #35) — Spec 004's B1 closed; B2 (this spec) is the only remaining unblocker for the tax-compliance use case.

P-01..P-20 authorized to build in branch `034-spec009-policy-engine-implementation`.