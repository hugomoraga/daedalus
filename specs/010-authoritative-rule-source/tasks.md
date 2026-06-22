# Tasks — Authoritative Rule Source (Process + Structure)

**Status:** Build **authorized** — Spec 010 v1.0.0 + Plan 010 v1.0.0 ratified 2026-06-22 (governance PR #48, branch `048-spec010-rule-source-ratify-pack`). R-01..R-20 ready to build in branch `049-spec010-rule-source-implementation`.
**Derives from:** [Spec 010](./spec.md) + [Plan 010](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-jurisdiction-model/spec.md) (provenance), [Spec 009](../009-policy-engine/spec.md) (event vocabulary + lineage), [Plan 008 §4.1](../../memory/technical-principles.md) (env-var pattern)
**Version:** 1.0.0
**Last updated:** 2026-06-22

> The `/tasks` step for Spec 010. Tasks map 1:1 to Plan 010 build steps. Activation criteria met (governance ratified, mechanical parts shipped in Spec 008); implementation unblocked.

---

## Phase A — Events + types

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **R-01** | `RuleSetRegistered` event type + payload. | `packages/core/src/domain/rule-source/rule-set-registered.ts` | §12.1 |
| **R-02** | `RuleSetSuperseded` event type + payload. | `packages/core/src/domain/rule-source/rule-set-superseded.ts` | §12.2 |
| **R-03** | `RuleSetStale` event type + payload. | `packages/core/src/domain/rule-source/rule-set-stale.ts` | §12.3 |
| **R-04** | `ObligationCoverageGap` event type + payload. | `packages/core/src/domain/rule-source/obligation-coverage-gap.ts` | §12.4 |
| **R-05** | `StalenessConfig` type + threshold-computation helper. | `packages/core/src/domain/rule-source/staleness.ts` | §11 |

## Phase B — Use cases

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **R-06** | `registerRuleSetUseCase(deps, store, input)` — validates via `validateProvenance`, emits `RuleSetRegistered`. | `packages/core/src/application/rule-source/register-rule-set.ts` | Plan §3.1 |
| **R-07** | `supersedeRuleSetUseCase(deps, input)` — emits `RuleSetSuperseded` (links new + old by shared `correlationId`). | `packages/core/src/application/rule-source/supersede-rule-set.ts` | Plan §3.2 |
| **R-08** | `sweepStalenessUseCase(deps, store, config, input)` — walks the tenant's RuleSet history, emits `RuleSetStale` for each that exceeds the threshold. | `packages/core/src/application/rule-source/sweep-staleness.ts` | Plan §3.3, Spec §11 |
| **R-09** | `listRuleSourcesUseCase(deps, store, config, input)` — returns a structured report (ok / stale / missing) for the CLI's `rules:list`. | `packages/core/src/application/rule-source/list-rule-sources.ts` | Plan §3.4 |

## Phase C — Default config

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **R-10** | `defaultStalenessConfig()` — env-var-driven defaults (12/6/3 months) per Plan §4. | `packages/core/src/adapters/rule-source/default-staleness-config.ts` | Spec §11 |
| **R-11** | Wire into `packages/core/src/adapters/index.ts` (add to existing barrel). | `packages/core/src/adapters/index.ts` (edit) | ADR-004 |

## Phase D — CLI commands (3 new)

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **R-12** | `rules:register --tenant <t> --ruleset <id>@<ver>` command. | `apps/cli/src/commands/rules-register.ts` (new file) | Plan §5 |
| **R-13** | `rules:list --tenant <t>` command. | `apps/cli/src/commands/rules-list.ts` (new file) | Plan §5 |
| **R-14** | `rules:sweep --tenant <t>` command. | `apps/cli/src/commands/rules-sweep.ts` (new file) | Plan §5 |
| **R-15** | Wire the 3 commands into `apps/cli/src/index.ts` (parseArgs + switch). | `apps/cli/src/index.ts` (edit) | Plan §5 |

## Phase E — Conformance & tests

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **R-16** | `tests/rule-source.test.ts` — 7 cases (Plan §6). | test file passing `npm test` | Plan §6 |
| **R-17** | `tests/cli-rules.test.ts` — CLI integration for the 3 new commands. | test file passing `npm test` | Plan §6 |
| **R-18** | Lint script `scripts/check-rule-source-staleness-thresholds.mjs` — fails on RuleSet JSON with `ageMonths > threshold`. Wired into `npm test`. | script + npm script entry | Plan §7 |
| **R-19** | Update `.env.example` with the 3 staleness env vars + a section about `verifiedBy` PII pattern. | `.env.example` (edit) | Plan §4 |

## Phase F — Documentation & unblock

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **R-20** | Update `specs/004-tax-compliance-guard/spec.md` §4 — mark B3 ✅ Closed. Status header v0.5.0; net 3 of 4 unblockers built. | edited spec 004 | Spec §10, §11, §12 |

## Sequencing

- Phase A and B are independent (types and pure functions can land together).
- Phase C depends on A + B.
- Phase D depends on A + B + C.
- Phase E depends on A + B + C + D.
- Phase F depends on E.

## Done criteria (v1.0)

- ✅ `npm test` is green (~146 → ~160 tests + 4 lint scripts).
- ✅ Adding a RuleSet JSON without `provenance` fails the build (Spec 008 lint, already shipped).
- ✅ Adding a RuleSet JSON with `ageMonths > threshold` fails the build (this spec's lint).
- ✅ Every RuleSet registration is recorded with full lineage (`RuleSetRegistered`).
- ✅ Staleness sweep produces `RuleSetStale` for every RuleSet above its threshold.
- ✅ `ObligationCoverageGap` is emitted by the system, never silently filled.
- ✅ No rule is invented, auto-fetched, or auto-updated. The system records what the human supplies.
- ✅ `.env.example` documents the staleness env vars + `verifiedBy` PII pattern.

## Out of scope (forward-planning)

- A scraping/integration pipeline.
- A marketplace, registry, or shared rule library.
- LLM-assisted rule interpretation.
- A DSL for rules.
- A live advisor integration.
- A "diff between rule versions" UI.
- A visual rule-authoring UI.

## Activation criteria for build (all satisfied)

- ✅ Spec 010 v1.0.0 ratified (this document + spec.md bumped).
- ✅ Plan 010 v1.0.0 ratified (this document + plan.md bumped).
- ✅ Spec 008 mechanical parts shipped (PR #35: `validateProvenance`, `FilesystemRuleSetLoaderAdapter` with version check).
- ✅ Spec 009 Policy Engine shipped (PR #47).
- ✅ Spec 004 B1 + B2 closed.

R-01..R-20 authorized to build in branch `049-spec010-rule-source-implementation`.

## Next natural step after R-01..R-20 ship

Spec 004 — Tax & Compliance Guard — v1.0 governance pack + implementation. Only B3 (this spec) was pending; with it shipped, Spec 004 has all its unblockers.