# Plan 008 — Jurisdiction Model (Core)

**Status:** Ratified · implementation plan for [Spec 008](./spec.md) v1.0.0
**Derives from:** [Spec 008](./spec.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 1.0.0
**Last updated:** 2026-06-21

> **Plan, now authorized for build.** Hexagonal layout per the canonical reference architecture. **Ports earn their place** — `JurisdictionPort` and `RuleSetLoaderPort` are introduced because they will have ≥2 plausible implementations (in-memory defaults + filesystem-backed; possibly more later). An "obligation evaluator" *is not* a Core port — it belongs in the Module.

---

## 0. Decisions carried from Spec 008

- **Core owns the shape, Module owns the interpretation.** The Core never evaluates an obligation.
- **RuleSet content lives in `config/rulesets/<tenant>/`** (data, not code). Loaded by a `FilesystemRuleSetLoaderAdapter` (default).
- **`RuleProvenance` is mandatory and lint-checked.** A rule without provenance is not a rule.
- **No invented rules in this repo.** The only RuleSet content that lands is **placeholder content** for tests + an explicit `tenant-declared` provenance marker pointing at the tenant's own input.

## 1. Package layout

```
packages/core/
  src/
    domain/jurisdiction/
      jurisdiction-profile.ts          # type (Tenant layer reference; Core shape)
      rule-set.ts                     # types: RuleSet, ObligationSpec, RuleProvenance
      jurisdiction-id.ts              # value object (opaque ISO 3166-1 alpha-2 wrapper, if used)
    application/jurisdiction/
      resolve-jurisdiction.ts         # pure function: (tenantId, asOf) -> { profile, rules }
      validate-provenance.ts          # pure function: rejects rules missing required fields
      ports/
        jurisdiction-port.ts          # interface
        rule-set-loader-port.ts       # interface
    adapters/jurisdiction/
      filesystem-rule-set-loader.ts   # default adapter (reads config/rulesets/<tenant>/...)
      in-memory-jurisdiction.ts       # for tests + Phase 1 default
  test/
    jurisdiction-model.test.ts        # round-trip; provenance rejection; tenant isolation
```

**No `Module/jurisdiction`** directory. Jurisdictional *interpretation* (deadline arithmetic, business-day logic, alert emission) belongs in `@daedalus/tax-compliance-guard` (Module #4). Core only resolves *which* profile and rules apply.

## 2. Port contracts (sketch)

```ts
// ports/jurisdiction-port.ts
export interface JurisdictionPort {
  loadProfile(tenantId: string, asOf: string): Promise<JurisdictionProfile | null>;
  recordProfileChange(input: {
    tenantId: string; actor: string; provenance: RuleProvenance;
    newProfile: JurisdictionProfile; previousProfileRef?: string;
  }): Promise<{ eventId: string }>; // emits JurisdictionProfileChanged via Core's EventStore
}

// ports/rule-set-loader-port.ts
export interface RuleSetLoaderPort {
  load(ruleSetRef: RuleSetRef, tenantId: string): Promise<RuleSet>;
  // Throws RuleSetProvenanceMissing if any obligation lacks provenance.
  // Throws RuleSetNotFound if no file at obligationsUri.
  // Throws RuleSetVersionMismatch if version in file != version in ref.
}
```

## 3. Hexagonal flow (read path)

```
Tax & Compliance Module (future)
  -> JurisdictionPort.loadProfile(tenantId, asOf)
  -> (default impl) InMemoryJurisdiction | FilesystemRuleSetLoaderAdapter
  -> returns JurisdictionProfile + RuleSet
  -> Module interprets (its own concern, out of scope here)
```

The Core never reaches *into* the Module. The Module never reaches *into* Core internals — only via the ports declared here.

## 4. Tenant layer (illustrative, not authoritative)

```
config/
  tenants/
    tenant-0.jurisdiction.ts           # committed; shape + env-var-driven values (see below)
  rulesets/
    tenant-0/
      .gitkeep                          # placeholders, NOT real rules
      README.md                         # explains "no real rules in repo" + how Tenant 0 adds them
.env                                      # gitignored; real values per-environment
.env.example                              # committed; documents every env var the system reads
```

The Core types live in `packages/core/src/domain/jurisdiction/`. The Tenant values live in `config/`. The boundary is **mechanical** — `config/` is git-tracked; `packages/core/` cannot import from it.

### 4.1 Env-var-driven tenant values (binding for v1)

Tenant-specific values (Tenant 0's actual country, currency, fiscal calendar, rule-set references, provenance `verifiedBy` identity) are **PII risk** and must not be hardcoded in committed `.ts` files. The pattern:

- **`config/tenants/tenant-0.jurisdiction.ts`** is committed and contains:
  - The **shape** (typed `TenantConfig` / `JurisdictionProfile` etc.).
  - Reads from `process.env.X` for every field, with a sensible default fallback.
- **`.env`** is **gitignored** (added to `.gitignore` in J-13.1 of the impl PR). Holds the real values per machine.
- **`.env.example`** is committed and documents every env var the system reads, with safe placeholder values (no real PII).
- **No `dotenv` dependency** — pure `process.env` access. Node 22+ is sufficient. Simplicity First.

Example shape (illustrative, the actual file is the founder's task):

```ts
// config/tenants/tenant-0.jurisdiction.ts (committed)
const env = (key: string, fallback?: string): string | undefined =>
  process.env[key] ?? fallback;

export const tenant0Jurisdiction = {
  jurisdiction: {
    countryCode: env("TENANT_0_JURISDICTION_COUNTRY_CODE", "CL") ?? "CL",
    subdivisionCode: env("TENANT_0_JURISDICTION_SUBDIVISION_CODE"),
  },
  calendar: {
    fiscalYearStart: {
      month: Number(env("TENANT_0_FY_START_MONTH", "1")),
      day: Number(env("TENANT_0_FY_START_DAY", "1")),
    },
    filingCadence: (env("TENANT_0_FILING_CADENCE", "monthly") ?? "monthly") as
      | "monthly" | "quarterly" | "annual" | "custom",
  },
  currency: env("TENANT_0_CURRENCY", "CLP") ?? "CLP",
  ruleSets: [], // populated by the founder when rules are sourced (Spec 010)
  effectiveFrom: env("TENANT_0_PROFILE_EFFECTIVE_FROM"),
};
```

**The Core stays generic** — it reads the profile through `JurisdictionPort`, never `process.env`. Env-var reading happens **only at the Tenant layer** (composition root, when the profile is loaded).

### 4.2 Why this matters (Principle 10 + AGENTS.md)

- Constitution Principle 10: tenant-specific data lives in the Tenant profile, never in Core. Env vars at the Tenant layer reinforce the boundary.
- AGENTS.md: "Never commit: Real tenant data or PII of any kind." The provenance `verifiedBy` (human identity vouching for the rules) is PII. Env vars keep it out of git history.
- Reproducibility: `.env.example` documents the schema; a new machine can `.env.example` → `.env` → fill in values and run.

## 5. Test strategy (small, no framework, no fixtures)

Per [Ponytail](../../../../../ponytail/AGENTS.md): non-trivial logic leaves ONE runnable check. We get more than one here because there are three distinct guarantees (provenance enforcement, version match, tenant isolation).

- `packages/core/test/jurisdiction-model.test.ts`:
  1. Load profile → emits nothing (read path).
  2. Load rule set missing provenance → throws `RuleSetProvenanceMissing`.
  3. Load rule set with version mismatch → throws `RuleSetVersionMismatch`.
  4. Two tenants, two profiles → zero cross-leak (resolve for tenant A returns only A's data).
  5. `JurisdictionProfileChanged` emitted with full lineage on profile write.

No external test runner added. Native `node --test`.

## 6. Conformance checks

A small lint script (a Node script, not a framework) verifies, on every CI run:
- `packages/core/src/**` contains **zero** strings matching a curated list of jurisdiction keywords (e.g. "Chile", "CLP", "SII", "IRS", "IVA", country names). The list is `config/jurisdiction/keywords.txt` — itself a fixture, not a Core file.
- Every JSON file under `config/rulesets/` parses, every obligation has `provenance`, every `provenance` has `verifiedBy`, `retrievedAt`, and `sourceId`.

This is the mechanical form of Constitution Principle 10 for the jurisdiction layer.

## 7. Out of scope for this plan

- The Tax & Compliance Module itself (Spec 004).
- The Policy Engine that will eventually evaluate obligations (Spec 009 stub).
- The authoritative-source acquisition process (Spec 010 stub).
- Rule versioning UI / diff tooling. Version bumps replace by reference; no migration logic.
- Multi-jurisdiction-per-tenant (deferred per Spec 008 §6).

---

*Subordinate to [Spec 008](./spec.md) and the canon. Hexagonal; ports earn their place; jurisdiction content stays in the Tenant layer.*