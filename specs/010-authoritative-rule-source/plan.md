# Plan 010 — Authoritative Rule Source (Process + Structure)

**Status:** Ratified · implementation plan for [Spec 010](./spec.md) v1.0.0
**Derives from:** [Spec 010](./spec.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-jurisdiction-model/spec.md) (provenance + env-var), [Spec 009](../009-policy-engine/spec.md) (event vocabulary + lineage), [Plan 008 §4.1](../../memory/technical-principles.md) (env-var pattern for tenant values)
**Version:** 1.0.0
**Last updated:** 2026-06-22

> The `/plan` step for Spec 010. The mechanical parts (provenance validation, version match, refuse-to-load) shipped in PR #35 (Spec 008 J-06 / J-10). This plan covers the four new Core events (`RuleSetRegistered`, `RuleSetSuperseded`, `RuleSetStale`, `ObligationCoverageGap`), the staleness sweep, the CLI helper to list rules + provenance, and the doc updates.

---

## 0. R1-R4 resolutions (from Spec 010 §9-§13)

- **R1 (process):** §9 documents a 14-step process the founder follows (sourcing → formatting → verification → registration → refresh → adjudication). Human-driven; the system records what the founder supplies.
- **R2 (`sourceId` format):** §10. Per-`sourceKind` conventions, all opaque to the system.
- **R3 (staleness policy):** §11. Defaults: 12 / 6 / 3 months per `sourceKind`. Tenant-overridable via env vars (`TENANT_0_STALENESS_*_MONTHS`).
- **R4 (conflict resolution):** §13. Most-specific jurisdiction wins; tie → most-recent `effectiveFrom`; tie → `ObligationCoverageGap` + escalate.

## 1. Package layout (lives in `@daedalus/core`)

The Authoritative Rule Source is a process + small Core additions. Like Spec 008 and Spec 009, it lives inside `@daedalus/core` (small enough that a new package would be premature). New pieces:

```
packages/core/src/
  domain/rule-source/
    rule-set-registered.ts            # domain event
    rule-set-superseded.ts            # domain event
    rule-set-stale.ts                  # domain event
    obligation-coverage-gap.ts        # domain event
    staleness.ts                       # type: staleness config + threshold computation
  application/rule-source/
    register-rule-set.ts               # use case: validate + emit RuleSetRegistered
    supersede-rule-set.ts              # use case: emit RuleSetSuperseded (links new + old)
    sweep-staleness.ts                 # use case: walk loaded rule sets, emit RuleSetStale
    list-rule-sources.ts               # use case: report rule sets + their provenance status
  adapters/rule-source/
    default-staleness-config.ts        # env-var-driven defaults (12/6/3 months)
```

A small CLI helper in `apps/cli/src/` adds three new commands:
- `rules:register --tenant <t> --ruleset <id>@<ver>` — calls `registerRuleSetUseCase`
- `rules:list --tenant <t>` — calls `listRuleSourcesUseCase` and prints a table
- `rules:sweep --tenant <t>` — calls `sweepStalenessUseCase` and emits the stale events

## 2. The four events (Core)

All four follow the lineage standard (ADR-004): `tenantId`, `actor`, `occurredAt`, `causationId`, `correlationId`, `payload`. The types are exported from `@daedalus/core` so the Tax & Compliance Module (Spec 004) and future consumers can import them.

### 2.1 `RuleSetRegistered`

Emitted on registration. The payload carries the minimum needed for audit + a future re-load (the `obligationsUri`). The provenance is the full `RuleProvenance` from the file.

```ts
RuleSetRegistered {
  payload: {
    ruleSetId, version, effectiveFrom,
    obligationsUri, ruleCount,
    provenance: RuleProvenance,
  }
}
```

### 2.2 `RuleSetSuperseded`

Emitted when a new version activates. The new `RuleSetRegistered` and the `RuleSetSuperseded` share a `correlationId` so audit can link them. The `actor` is the founder; `cause` is the new `RuleSetRegistered`'s `eventId`.

```ts
RuleSetSuperseded {
  payload: {
    ruleSetId,
    previousVersion, newVersion,
    previousEffectiveFrom, newEffectiveFrom,
  }
}
```

### 2.3 `RuleSetStale`

Emitted by the staleness sweep (run on engine boot or on demand via `rules:sweep`). The `actor` is `"system"`. The payload is informational; the Tenant decides what to do.

```ts
RuleSetStale {
  payload: {
    ruleSetId, version,
    sourceKind, retrievedAt,
    ageMonths, thresholdMonths,
  }
}
```

### 2.4 `ObligationCoverageGap`

Emitted by Spec 004 (or any Module that consumes RuleSets) when an obligation cannot be evaluated. The system does **not** invent a rule; it surfaces the gap. The payload includes the candidate RuleSets considered, so the founder can adjudicate.

```ts
ObligationCoverageGap {
  payload: {
    obligationId, obligationHumanName,
    reason: "no-rule-matches" | "all-matching-rules-stale" | "conflicting-rules-no-precedence",
    candidateRuleSets: Array<{ ruleSetId, version, effectiveFrom, jurisdictionRef }>,
  }
}
```

## 3. The use cases

### 3.1 `registerRuleSetUseCase`

Validates the RuleSet (calls `validateProvenance` from Spec 008), then emits `RuleSetRegistered` via Core's canonical pipeline. Returns the eventId.

```ts
async function registerRuleSetUseCase(
  deps: CoreDeps,
  store: RuleSetLoaderPort,  // from Spec 008
  input: { tenantId, actor, ref: RuleSetRef, obligations: ObligationSpec[] }
): Promise<{ eventId: string }>
```

### 3.2 `supersedeRuleSetUseCase`

Emits `RuleSetSuperseded`. Caller supplies the previous and new versions. The `correlationId` is shared with the new `RuleSetRegistered` (the caller passes it in).

### 3.3 `sweepStalenessUseCase`

Walks every RuleSet a tenant has registered (in their event stream), computes `ageMonths` from `retrievedAt`, and emits `RuleSetStale` for each one that exceeds the threshold. Idempotent: re-running the sweep emits a new `RuleSetStale` for each still-stale rule (so the audit trail shows when the system re-checked). Future Spec may add a "last checked" cache to suppress duplicates within a window; v1.0 does not.

### 3.4 `listRuleSourcesUseCase`

Returns a structured report of every RuleSet a tenant has registered + its provenance status (`ok` / `stale` / `missing` if the file disappeared). Used by the `rules:list` CLI command.

## 4. Default staleness config (env-var-driven, mirrors Plan 008 §4.1)

```ts
// packages/core/src/adapters/rule-source/default-staleness-config.ts
function envMonths(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const defaults: StalenessConfig = {
  thresholds: {
    "official-publication": envMonths("TENANT_0_STALENESS_OFFICIAL_PUBLICATION_MONTHS", 12),
    "legal-advisor-opinion": envMonths("TENANT_0_STALENESS_LEGAL_ADVISOR_OPINION_MONTHS", 6),
    "tenant-declared": envMonths("TENANT_0_STALENESS_TENANT_DECLARED_MONTHS", 3),
  },
};
```

Updates to `.env.example` (mirror of Spec 008's env-var pattern):
```
TENANT_0_STALENESS_OFFICIAL_PUBLICATION_MONTHS=12
TENANT_0_STALENESS_LEGAL_ADVISOR_OPINION_MONTHS=6
TENANT_0_STALENESS_TENANT_DECLARED_MONTHS=3
```

## 5. CLI additions (3 new commands in `apps/cli`)

- `rules:register --tenant <t> --ruleset <id>@<ver>` — calls `registerRuleSetUseCase`. Validates the RuleSet first; if validation fails, prints the error and exits 1.
- `rules:list --tenant <t>` — prints a table: `ruleSetId  version  effectiveFrom  sourceKind  verifiedBy  ageMonths  status` (status ∈ `ok`, `stale`, `missing`).
- `rules:sweep --tenant <t>` — calls `sweepStalenessUseCase`. Prints the count of stale RuleSets found.

Each command follows the existing CLI pattern (no business logic; just parse + dispatch + render). The use cases are in `@daedalus/core`; the CLI imports them via the curated public contract.

## 6. Test strategy (`tests/rule-source.test.ts`)

7 cases:

1. `RuleSetRegistered` emitted on register; full lineage; payload includes `provenance`.
2. `RuleSetSuperseded` links previous + new; `correlationId` shared with the new `RuleSetRegistered`.
3. `RuleSetStale` emitted for a rule set whose `retrievedAt` exceeds the threshold; `actor: "system"`.
4. `RuleSetStale` not emitted for a fresh rule set.
5. `ObligationCoverageGap` emitted when a Module reports an unevaluable obligation; `reason: "no-rule-matches"`.
6. `ObligationCoverageGap` with `reason: "conflicting-rules-no-precedence"` includes the candidate rule sets.
7. Conflict resolution: most-specific jurisdiction wins; tie → `effectiveFrom`; final tie → `ObligationCoverageGap`.

Plus a CLI integration test in `tests/cli-rules.test.ts` (mirrors the existing CLI test pattern; small, exercises the 3 new commands against an in-memory adapter).

## 7. Conformance (binding)

A new lint script `scripts/check-rule-source-staleness-thresholds.mjs` walks `config/rulesets/**/*.json`, reads `provenance.retrievedAt`, and fails the build if any rule's `ageMonths` exceeds the configured threshold (or the default). Wired into `npm test`. Mirrors `check-rulesets-have-provenance.mjs` (Spec 008) and `check-policies-have-provenance.mjs` (Spec 009).

The existing `check-rulesets-have-provenance.mjs` (Spec 008) still enforces the provenance *shape*. This new script enforces the staleness *threshold*.

## 8. Definition of done (v1.0)

- 4 new domain events + their types in `packages/core/src/domain/rule-source/`.
- 4 use cases in `packages/core/src/application/rule-source/`.
- 1 default config adapter in `packages/core/src/adapters/rule-source/`.
- `packages/core/src/index.ts` exports the curated contract (event type constants + types + use case signatures + the default staleness config).
- `packages/core/src/adapters/index.ts` exports the default config.
- 3 new CLI commands (`rules:register`, `rules:list`, `rules:sweep`).
- `tests/rule-source.test.ts` (7 cases) + `tests/cli-rules.test.ts` (CLI integration) — both green.
- `scripts/check-rule-source-staleness-thresholds.mjs` wired into `npm test`.
- `.env.example` updated with the 3 staleness env vars.
- `specs/004-tax-compliance-guard/spec.md` §4 — mark B3 ✅ Closed.
- `npm test` is green: 146 → ~160 tests + 4 lint scripts.

## 9. Out of scope (binding — forward-planning only)

- A scraping/integration pipeline.
- A marketplace, registry, or shared rule library.
- LLM-assisted rule interpretation.
- A DSL for rules.
- A "diff between rule versions" UI.
- A visual rule-authoring UI.
- A live advisor integration.

## 10. Sequencing

- Phase A (types + events) and Phase B (use cases) are independent; can land together.
- Phase C (default config) depends on A + B.
- Phase D (CLI commands) depends on A + B + C.
- Phase E (tests + lint) depends on A + B + C + D.
- Phase F (docs + unblock) depends on E.

P-01..P-20 (mirror of Spec 008/009's P-XX / J-XX naming) are tracked in tasks.md.