# Tasks — Authoritative Rule Source (Process + Structure)

**Status:** v1 **SHIPPED** — Spec 010 v1.0.0 + Plan 010 v1.0.0 + 20 tasks ✅ (impl PR #50, branch `049-spec010-rule-source-implementation`). Spec 004 B3 ✅ Closed.
**Derives from:** [Spec 010](./spec.md) + [Plan 010](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-jurisdiction-model/spec.md) (provenance), [Spec 009](../009-policy-engine/spec.md) (event vocabulary + lineage), [Plan 008 §4.1](../../memory/technical-principles.md) (env-var pattern)
**Version:** 1.1.0
**Last updated:** 2026-06-22

> The `/tasks` step for Spec 010. Tasks map 1:1 to Plan 010 build steps. Activation criteria met (governance ratified, mechanical parts shipped in Spec 008); implementation unblocked.

---

## Phase A — Events + types ✅

| ID | Task | Status |
|---|---|---|
| R-01 | `RuleSetRegistered` event type + payload | ✅ |
| R-02 | `RuleSetSuperseded` event type + payload | ✅ |
| R-03 | `RuleSetStale` event type + payload | ✅ |
| R-04 | `ObligationCoverageGap` event type + payload | ✅ |
| R-05 | `StalenessConfig` type + threshold-computation helper | ✅ |

## Phase B — Use cases ✅

| ID | Task | Status |
|---|---|---|
| R-06 | `registerRuleSetUseCase` | ✅ |
| R-07 | `supersedeRuleSetUseCase` | ✅ |
| R-08 | `sweepStalenessUseCase` (uses `actor: "system"`) | ✅ |
| R-09 | `listRuleSourcesUseCase` | ✅ |

## Phase C — Default config ✅

| ID | Task | Status |
|---|---|---|
| R-10 | `defaultStalenessConfig()` env-var-driven | ✅ |
| R-11 | Wired into `packages/core/src/adapters/index.ts` | ✅ |

## Phase D — CLI commands (3 new) ✅

| ID | Task | Status |
|---|---|---|
| R-12 | `rules:register` | ✅ (consolidated in `apps/cli/src/commands/rules.ts`) |
| R-13 | `rules:list` | ✅ |
| R-14 | `rules:sweep` | ✅ |
| R-15 | Wired into `apps/cli/src/index.ts` + help text | ✅ |

## Phase E — Conformance & tests ✅

| ID | Task | Status |
|---|---|---|
| R-16 | `tests/rule-source.test.ts` — 7 cases | ✅ |
| R-17 | CLI integration covered via the same suite (no separate file needed; CLI commands are thin wrappers) | ⏭️ (consolidated) |
| R-18 | `scripts/check-rule-source-staleness.mjs` wired into `npm test` | ✅ |
| R-19 | `.env.example` updated with the 3 staleness env vars | ✅ |

## Phase F — Documentation & unblock ✅

| ID | Task | Status |
|---|---|---|
| R-20 | `specs/004-tax-compliance-guard/spec.md` §4 B3 marked ✅ Closed; Status v0.5.0; net 3 of 4 unblockers built | ✅ |

---

## Done criteria (all met)

- ✅ `npm test` is green: 146 → **153 tests** (7 new) + **4 lint scripts** all green.
- ✅ Adding a RuleSet JSON without `provenance` fails the build (Spec 008 lint).
- ✅ Adding a RuleSet JSON with `ageMonths > threshold` fails the build (this spec's lint).
- ✅ Every RuleSet registration is recorded with full lineage (`RuleSetRegistered`).
- ✅ Staleness sweep produces `RuleSetStale` for every RuleSet above its threshold; `actor: "system"`.
- ✅ `ObligationCoverageGap` is emitted by the system, never silently filled.
- ✅ No rule is invented, auto-fetched, or auto-updated.
- ✅ `.env.example` documents the staleness env vars + `verifiedBy` PII pattern.
- ✅ **Spec 004 B3 closed** — the last unblocker.

## Bonus: Spec 008 bug fix shipped in this PR

`validateProvenance` (Spec 008 J-06) and `FilesystemRuleSetLoaderAdapter` were checking the wrong field name (`ref.source` instead of `ref.provenance`). This was a latent bug from PR #35 that wasn't caught because the test data used the wrong field name too. Both sides fixed; jurisdiction tests updated to use `provenance`.

## Out of scope (still)

- A scraping/integration pipeline.
- A marketplace, registry, or shared rule library.
- LLM-assisted rule interpretation.
- A DSL for rules.
- A live advisor integration.
- A "diff between rule versions" UI.
- A visual rule-authoring UI.

## Next natural step

**Spec 004 — Tax & Compliance Guard — v1.0 governance pack + implementation.** With B3 closed, all 4 of Spec 004's unblockers are built. Tax & Compliance Guard becomes buildable."