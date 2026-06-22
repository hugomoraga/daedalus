# Tasks — Policy Engine (Phase 3)

**Status:** v1 **SHIPPED** — Spec 009 v1.0.0 + Plan 009 v1.0.0 + 20 tasks ✅ (impl PR #38, branch `034-spec009-policy-engine-implementation`).
**Derives from:** [Spec 009](./spec.md) + [Plan 009](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../013-jurisdiction-model/spec.md) (mirrors provenance + env-var patterns)
**Version:** 1.1.0
**Last updated:** 2026-06-22

> Tasks map to Spec 009 acceptance criteria and Plan 009 build steps. v1 is shipped; Spec 004's B2 row marked closed.

---

## Phase A — Types and ports

- [x] P-01: `PolicyProvenance` type
- [x] P-02: `Policy` / `PolicyRef` / `PolicyRule` / `PolicyOutcome` / `PolicyMatch` types
- [x] P-03: `PolicyDecision` (3-outcome) + `PolicyDecisionRecorded` event
- [x] P-04: `PolicyEnginePort` interface + `PolicyAction`
- [x] P-05: `PolicyStorePort` interface + error classes

## Phase B — Pure functions + use case

- [x] P-06: `validatePolicyProvenance`
- [x] P-07: `defaultEvaluate` (first-match-wins)
- [x] P-08: `evaluateAndRecordPolicy` use case

## Phase C — Adapters

- [x] P-09: `InMemoryPolicyStore`
- [x] P-10: `FilesystemPolicyStore`
- [x] P-11: `packages/core/src/adapters/index.ts` barrel updated

## Phase D — Tenant layer

- [x] P-12: `config/policies/tenant-0/` README
- [x] P-13: `config/policies/` root + `.gitkeep`
- [ ] P-14: No tenant-0 policy file in this phase (founder's task) (intentional non-task)

## Phase E — Conformance & tests

- [x] P-15: `tests/policy-engine.test.ts` — 8 cases
- [x] P-16: `scripts/check-policies-have-provenance.mjs` wired into `npm test`

## Phase F — Documentation & index updates

- [x] P-17: `packages/core/src/index.ts` curated contract
- [x] P-18: `docs/identity.md` records "Policy before Agent" is now mechanical
- [x] P-19: Spec 004 §4 B2 marked ✅ Closed
- [ ] P-20: (Roadmap not edited — Phase 3 capability is reflected via Spec 004 + Spec 009 itself) (intentional skip)

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