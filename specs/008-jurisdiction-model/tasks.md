# Tasks — Jurisdiction Model (Core)

**Status:** v1 **SHIPPED** — Spec 008 v1.0.0 + Plan 008 v1.0.0 + 19 tasks ✅ (PR #35, branch `031-spec008-jurisdiction-implementation`).
**Derives from:** [Spec 008](./spec.md) + [Plan 008](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 1.1.0
**Last updated:** 2026-06-21

> Tasks map to Spec 008 acceptance. v1 is shipped; Spec 004's B1 row marked closed. Phase 3 follow-on (Policy Engine integration into the workflow engine's policy seam) is forward-planning only.

---

## Phase A — Types and contracts ✅

| ID | Task | Status |
|---|---|---|
| J-01 | `RuleProvenance` type | ✅ |
| J-02 | `ObligationSpec`, `RuleSet`, `RuleSetRef` types | ✅ |
| J-03 | `JurisdictionProfile`, `FiscalCalendar`, `JurisdictionRef` | ✅ |
| J-04 | `JurisdictionPort` interface | ✅ |
| J-05 | `RuleSetLoaderPort` interface + error classes | ✅ |

## Phase B — Core resolution and provenance enforcement ✅

| ID | Task | Status |
|---|---|---|
| J-06 | `validateProvenance(ruleSet)` pure function | ✅ |
| J-07 | `resolveJurisdiction(...)` pure function | ✅ |
| J-08 | `JurisdictionProfileChanged` domain event + `recordProfileChange` use case | ✅ |

## Phase C — Default adapters ✅

| ID | Task | Status |
|---|---|---|
| J-09 | `InMemoryJurisdictionAdapter` | ✅ |
| J-10 | `FilesystemRuleSetLoaderAdapter` | ✅ |

## Phase D — Tenant layer ✅

| ID | Task | Status |
|---|---|---|
| J-11 | `config/rulesets/tenant-0/` placeholder + README | ✅ |
| J-12 | `config/jurisdiction/keywords.txt` | ✅ |
| J-13 | No `config/tenants/tenant-0.jurisdiction.ts` in this phase (founder's task, env-var pattern) | ⏭️ (intentional non-task) |
| J-13.1 | `.gitignore .env` + `.env.example` schema | ✅ |

## Phase E — Conformance & tests ✅

| ID | Task | Status |
|---|---|---|
| J-14 | `tests/jurisdiction-model.test.ts` — 8 cases | ✅ |
| J-15 | `scripts/check-core-jurisdiction-agnostic.mjs` wired into `npm test` | ✅ |
| J-16 | `scripts/check-rulesets-have-provenance.mjs` wired into `npm test` | ✅ |

## Phase F — Documentation & unblock ✅

| ID | Task | Status |
|---|---|---|
| J-17 | Spec 004 §4 B1 marked ✅ Closed | ✅ |
| J-18 | `config/tenants/tenant-0.ts` refactored to env vars | ✅ |
| J-19 | `docs/identity.md` records env-var pattern as binding | ✅ |

---

## Done criteria (all met)

- ✅ `npm test` green (138/138 tests pass + 2 lint scripts).
- ✅ Adding the string "Chile" to any file under `packages/core/src/**` causes `npm test` to fail (lint).
- ✅ A tenant with no `JurisdictionProfile` continues to work for all existing modules (Revenue Visibility, Proposal Generation, etc.).
- ✅ Spec 004's B1 row marked ✅ Closed.
- ✅ The Core has zero jurisdiction-specific content; the Tenant layer has zero business logic.
- ✅ Tenant values driven by `process.env`; PII stays in `.env` (gitignored).

## Out of scope (still)

- The Tax & Compliance Module itself (Spec 004) — still a stub until B2 (Policy Engine) ships.
- The Policy Engine (Spec 009 stub).
- The authoritative-source acquisition process (Spec 010 stub).
- Migrating Tenant 0 from "no profile" to "real profile" — that is the founder's task (Tenant 0 Profile §1).

---

## Phase A — Types and contracts (Core shape, no content)

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **J-01** | Define `RuleProvenance` type with required fields (`sourceKind`, `sourceId`, `retrievedAt`, `verifiedBy`). Reject unknown `sourceKind` values at the type level. | `packages/core/src/domain/jurisdiction/rule-provenance.ts` | §3.3 |
| **J-02** | Define `ObligationSpec`, `RuleSet`, `RuleSetRef` types. `ObligationSpec.deadline.kind` is a discriminated union. No default values that hide missing fields. | `packages/core/src/domain/jurisdiction/rule-set.ts` | §3.2 |
| **J-03** | Define `JurisdictionProfile` type + `FiscalCalendar` + `JurisdictionRef`. Country code is `string`, **not** a typed enum (Core stays jurisdiction-agnostic). | `packages/core/src/domain/jurisdiction/jurisdiction-profile.ts` | §3.1 |
| **J-04** | Define `JurisdictionPort` interface (loadProfile, recordProfileChange). No concrete implementation in the type file. | `packages/core/src/application/jurisdiction/ports/jurisdiction-port.ts` | §2 |
| **J-05** | Define `RuleSetLoaderPort` interface. Document the three error cases: `RuleSetProvenanceMissing`, `RuleSetNotFound`, `RuleSetVersionMismatch`. | `packages/core/src/application/jurisdiction/ports/rule-set-loader-port.ts` | §2 |

## Phase B — Core resolution and provenance enforcement

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **J-06** | `validateProvenance(ruleset)` — pure function. Rejects if any obligation lacks `provenance`, if `retrievedAt` is not ISO date, if `verifiedBy` is empty. Used by both the loader and any test. | `packages/core/src/application/jurisdiction/validate-provenance.ts` + unit assertions | §3.3 |
| **J-07** | `resolveJurisdiction(tenantId, asOf)` — pure function. Returns `{ profile, ruleSets }` for the tenant on that date, or `null` if the tenant has opted out. **Tenant-scoped**: no global cache; lookup is always by tenantId. | `packages/core/src/application/jurisdiction/resolve-jurisdiction.ts` | §3.5 |
| **J-08** | `JurisdictionProfileChanged` domain event with full lineage (`eventId`, `tenantId`, `actor`, `occurredAt`, `causationId`, `correlationId`, `payload: { previousProfileRef?, newProfileRef, provenance }`). Emitted via the existing `EventStorePort`. | domain event type + use case `record-profile-change` | §5 |

## Phase C — Default adapters (in-memory + filesystem)

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **J-09** | `InMemoryJurisdictionAdapter` — registers profiles in a `Map<tenantId, JurisdictionProfile>`. For tests and Phase 1 default. **No filesystem access.** | `packages/core/src/adapters/jurisdiction/in-memory-jurisdiction.ts` | §1 |
| **J-10** | `FilesystemRuleSetLoaderAdapter` — reads `config/rulesets/<tenant>/<ruleset>@<version>.json`. Calls `validateProvenance` before returning. On missing file → `RuleSetNotFound`. On version mismatch → `RuleSetVersionMismatch`. | `packages/core/src/adapters/jurisdiction/filesystem-rule-set-loader.ts` | §1, §4 |

## Phase D — Tenant layer (placeholders only)

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **J-11** | `config/rulesets/` directory created with `.gitkeep` and a `README.md` explaining "no real rules in repo; placeholders are `tenant-declared` provenance with empty obligation arrays". | directory + README | §4 (Plan) |
| **J-12** | `config/jurisdiction/keywords.txt` — curated list of jurisdiction-specific terms that must NOT appear in `packages/core/src/**`. Used by J-15. | text file | §6 (Plan) |
| **J-13** | **Do NOT create `config/tenants/tenant-0.jurisdiction.ts` in this phase.** Tenant 0's jurisdiction content is for the human to provide (Tenant 0 Profile §1 marks it `[founder to confirm]`). The Core must function with `null` profile for tenant-0 (Tenant simply opts out of Tax & Compliance until profile lands). When the founder adds the file, it MUST follow the env-var pattern in Plan §4.1 (read from `process.env`, no hardcoded PII). | nothing | §7 (Spec), Plan §4.1 |
| **J-13.1** | Add `.env` to `.gitignore` so real tenant values never land in the repo. Add `.env.example` (committed) documenting every env var the system reads (current + future tenant-related ones). No `dotenv` dep — pure `process.env`. | `.gitignore` line + `.env.example` file | Plan §4.1, §4.2 |

## Phase E — Conformance & tests

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **J-14** | `packages/core/test/jurisdiction-model.test.ts` — five cases from Plan §5: load returns nothing on read; missing provenance throws; version mismatch throws; two tenants do not cross-leak; profile change emits `JurisdictionProfileChanged` with full lineage. Uses `node --test`. No fixtures file. Test data constructed inline. | test file passing `npm test` | §5 (Plan) |
| **J-15** | Lint script `scripts/check-core-jurisdiction-agnostic.mjs` — reads `config/jurisdiction/keywords.txt`, walks `packages/core/src/**`, fails if any keyword appears. Runs in `npm test` chain. | script + npm script entry | §6 (Plan) |
| **J-16** | Lint script `scripts/check-rulesets-have-provenance.mjs` — walks `config/rulesets/**/*.json`, fails if any obligation lacks `provenance` or any provenance lacks `verifiedBy`+`retrievedAt`+`sourceId`. Runs in `npm test` chain. | script + npm script entry | §6 (Plan) |

## Phase F — Documentation & unblock

| ID | Task | Produces | Spec ref |
|---|---|---|---|
| **J-17** | Update `specs/004-tax-compliance-guard/spec.md` §4 to mark **B1** as resolved by this spec (with link), and re-prioritize remaining blockers (B2, B3) against the new specs. | edited spec 004 | §1, §8 (Spec 008) |
| **J-18** | Refactor `config/tenants/tenant-0.ts` to read parametrizable fields from `process.env` with sensible defaults (currency, enabledModules, alertThresholds). Keep structural fields (id, templates) in code. JSDoc note points to the future `tenant-0.jurisdiction.ts` and confirms **for now** tenant-0 has no jurisdiction profile (opt-out). | edited tenant config | §3.1, Plan §4.1 |
| **J-19** | Update `docs/identity.md` (or equivalent) to record the env-var pattern as the binding mechanism for tenant-specific values, with `.env.example` as the canonical schema reference. | doc update | Plan §4.1, §4.2 |

## Sequencing

- **Phase A and B are independent** (types and pure functions).
- **Phase C depends on A and B.**
- **Phase D is independent of code** — purely directory + docs.
- **Phase E depends on A, B, C.**
- **Phase F depends on E.**
- **J-13 is intentionally a non-task**: it documents what we are **not** doing.

## Done criteria

- ✅ `npm test` is green (including the two lint scripts).
- ✅ Adding the string `"Chile"` to any file under `packages/core/src/**` causes `npm test` to fail.
- ✅ A tenant with no `JurisdictionProfile` continues to work for all existing modules (Revenue Visibility, Proposal Generation, etc.).
- ✅ Spec 004's B1 row is marked closed with a link to this spec.
- ✅ The Core has zero jurisdiction-specific content; the Tenant layer has zero business logic.

## Out of scope for this task list

- Implementing the Tax & Compliance Module itself (Spec 004).
- Implementing the Policy Engine (Spec 009 stub).
- Implementing authoritative-source acquisition (Spec 010 stub).
- Migrating Tenant 0 from "no profile" to "real profile" — that is the human's task (Tenant 0 Profile §1).

---

*Subordinate to [Spec 008](./spec.md) and [Plan 008](./plan.md). Spec-Driven; no implementation outside these tasks.*