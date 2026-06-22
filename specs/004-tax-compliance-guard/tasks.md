# Tasks — Tax & Compliance Guard (Module)

**Status:** ✅ **SHIPPED** — Spec 004 v1.0.0 + Plan 004 v1.0.0 ratified 2026-06-22 (governance PR #52, branch `051-spec004-tax-compliance-ratify-pack`). T-01..T-20 implemented 2026-06-22 (impl PR #53, branch `052-spec004-tax-compliance-implementation`). All 4 unblockers built; 164/164 tests + 4 lint scripts green.
**Derives from:** [Spec 004](./spec.md) + [Plan 004](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../013-jurisdiction-model/spec.md), [Spec 009](../009-policy-engine/spec.md), [Spec 010](../010-authoritative-rule-source/spec.md)
**Version:** 1.0.0
**Last updated:** 2026-06-22

> The `/tasks` step for the Tax & Compliance Guard Module. v1.0 is the **guard**, not the engine. Tasks map 1:1 to Spec 004 acceptance criteria and Plan 004 build steps.

---

## Phase A — Domain types + pure helpers

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **T-01** | `ObligationDue` / `ObligationMet` / `ObligationMissed` / `ObligationEvaluationRecorded` event types + payload types. | `packages/tax-compliance-guard/src/domain/obligation.ts` | §4 |
| **T-02** | `computeDeadline(deadlineSpec, triggerTime)` — pure function. v1.0: simple day count for `offset-from-trigger`; `fixed-calendar` returns the calendar date. | `packages/tax-compliance-guard/src/application/compute-deadline.ts` | §3.2 |
| **T-03** | `deriveObligationStates(events)` — pure function. Given a tenant's event stream, returns the current state of every obligation (`pending` / `met` / `missed`). | `packages/tax-compliance-guard/src/application/obligation-state.ts` | §7, AC-9 |
| **T-04** | `TaxComplianceDeps` — Module deps shape. Extends `CoreDeps` with `RuleSetLoaderPort` + `PolicyEnginePort` + a tax-compliance-policy reference constant. | `packages/tax-compliance-guard/src/application/deps.ts` | Plan §5 |

## Phase B — Use cases

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **T-05** | `watchFinancialEventsUseCase(deps, event)` — find matching obligations, emit `ObligationDue` + `ObligationEvaluationRecorded`, fall through to `ObligationCoverageGap` when no match. | `packages/tax-compliance-guard/src/application/watch-financial-events.ts` | §3.1, AC-1, AC-4, AC-5, AC-6, AC-7 |
| **T-06** | `sweepDeadlinesUseCase(deps, tenantId, asOf?)` — derives state, emits `ObligationMissed` for past-due obligations. Idempotent. | `packages/tax-compliance-guard/src/application/sweep-deadlines.ts` | §3.2, AC-2 |
| **T-07** | `acknowledgeObligationUseCase(deps, input)` — validates the obligation is `pending`, emits `ObligationMet`. | `packages/tax-compliance-guard/src/application/acknowledge-obligation.ts` | §3.3, AC-3 |
| **T-08** | `listObligationsUseCase(deps, tenantId)` — returns the structured report (live state). | `packages/tax-compliance-guard/src/application/list-obligations.ts` | §3.4 |
| **T-09** | `evaluateTaxPolicyUseCase(deps, obligationContext)` — convenience wrapper. Loads the tax-compliance-policy bundle (or defaults to `allow` if absent), invokes the Policy Engine, returns the decision. | `packages/tax-compliance-guard/src/application/evaluate-tax-policy.ts` | §3.5, AC-4, AC-5, AC-6 |

## Phase C — Public contract + CLI

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **T-10** | `packages/tax-compliance-guard/src/index.ts` — curated public contract (event types + use cases + pure helpers + deps type). | `index.ts` | Plan §5, ADR-004 |
| **T-11** | `packages/tax-compliance-guard/package.json` — `@daedalus/tax-compliance-guard` v0.0.0, no external deps, dep on `@daedalus/core`. | `package.json` | Plan §1 |
| **T-12** | `apps/cli/src/commands/obligations.ts` — 3 commands (list / ack / sweep). | per-command-files pattern | §6 |
| **T-13** | Wire the 3 commands into `apps/cli/src/index.ts` (parseArgs + switch) + `apps/cli/src/commands/help.ts`. | `index.ts` + `help.ts` (edit) | §6 |

## Phase D — Conformance & tests

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **T-14** | `tests/tax-compliance-guard.test.ts` — 9 cases (the ACs below). Uses `node --test`. Test data constructed inline. | test file passing `npm test` | §7 |
| **T-15** | `tests/cli-obligations.test.ts` — CLI integration for the 3 commands. | test file passing `npm test` | §7 |

### Acceptance cases (T-14)

- **AC-1:** `PaymentReceived` + matching obligation → `ObligationDue` with computed `dueAt`.
- **AC-2:** `pending` obligation past `dueAt` → `ObligationMissed`.
- **AC-3:** `obligations:ack` → `ObligationMet`.
- **AC-4:** tax-compliance-policy with allow rule → `ObligationEvaluationRecorded` outcome=allow.
- **AC-5:** tax-compliance-policy with escalate rule → `outcome=escalate, gateRef=...`.
- **AC-6:** no policy bundle → `outcome=allow, reason="no-policy-bundle"`.
- **AC-7:** no matching obligation → `ObligationCoverageGap`.
- **AC-8:** tenant isolation: cross-tenant lookups return nothing.
- **AC-9:** replay determinism: same event stream → same obligation events in same order with same lineage.

## Phase E — Documentation & unblock

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **T-16** | `packages/core/package.json` — add `@daedalus/tax-compliance-guard` to the workspace. | `package.json` (workspace entry) | Plan §1 |
| **T-17** | `docs/identity.md` — record "Tax & Compliance Guard shipped; the system guards; the human claims compliance". | doc update | §13 |
| **T-18** | `docs/roadmap.md` — flip Phase 3 capability as ✅ Built (Tax & Compliance Guard shipped); the Policy Engine ships separately as the substrate. | roadmap update | §15 |
| **T-19** | `config/rulesets/tenant-0/README.md` — note that the founder adds a tenant-0 rule set (Spec 010 §9 process) as the seed for the Module's first test. NOT a real rule. | doc update | Spec 010 |
| **T-20** | `specs/004-tax-compliance-guard/tasks.md` — flip status to SHIPPED. | self-update | self |

## Sequencing

- Phase A and B can land together (types + pure functions + use cases).
- Phase C depends on A + B (the public contract references the use cases; the CLI imports the contract).
- Phase D depends on A + B + C.
- Phase E depends on D.

## Done criteria (v1.0)

- ✅ `npm test` is green: 153 → ~165 tests + 4 lint scripts.
- ✅ The Module adds no jurisdiction-specific content to `@daedalus/core` (`lint:core-jurisdiction-agnostic` still passes).
- ✅ Every obligation event carries full lineage per ADR-004.
- ✅ `ObligationMet` is human-only.
- ✅ No auto-refresh, no auto-ack, no auto-resolution. The human decides.
- ✅ The 🚩 Compliance Flag (Spec 004 §13) holds.
- ✅ Spec 004 v1.0 is buildable end-to-end; all 4 unblockers are built.

## Out of scope (still)

- Business-day calendar arithmetic.
- A DSL for obligations.
- Multi-jurisdiction-per-tenant.
- LLM-assisted rule interpretation.
- SII integration, PDF generation, tax filing.
- A visual obligation editor.
- An ATLAS obligation dashboard.

## Activation criteria (all satisfied)

- ✅ Spec 004 v1.0.0 ratified (this document + spec.md + plan.md bumped).
- ✅ All 4 unblockers built (B1 Jurisdiction, B2 Policy, B3 Rule Source, B4 Revenue Visibility).
- ✅ `npm test` is green on `main` (153/153 + 4 lint scripts).

T-01..T-20 authorized to build in branch `052-spec004-tax-compliance-implementation`.