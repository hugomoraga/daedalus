# Tasks — Jurisdiction Model (Core)

**Status:** Draft · **unlocks Spec 004 B1** · accompanies [Spec 008](./spec.md) and [Plan 008](./plan.md)
**Version:** 0.1.0
**Last updated:** 2026-06-21

> Tasks map to Spec 008 acceptance. **No code in this file** — only the work units. Each task states what verifiable artifact it produces.

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
| **J-13** | **Do NOT create `config/tenants/tenant-0.jurisdiction.ts` in this phase.** Tenant 0's jurisdiction content is for the human to provide (Tenant 0 Profile §1 marks it `[founder to confirm]`). The Core must function with `null` profile for tenant-0 (Tenant simply opts out of Tax & Compliance until profile lands). | nothing | §7 (Spec) |

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
| **J-18** | Update `config/tenants/tenant-0.ts` JSDoc comment to point to `config/tenants/tenant-0.jurisdiction.ts` as the (future) jurisdiction file, and to record that **for now** tenant-0 has no jurisdiction profile (opt-out). | edited tenant config | §3.1 |

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