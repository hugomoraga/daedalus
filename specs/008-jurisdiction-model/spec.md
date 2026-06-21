# Spec 008 — Jurisdiction Model (Core capability)

**Status:** Draft · **foundational** · unlocks [Spec 004](../004-tax-compliance-guard/spec.md) B1
**Type:** Core capability specification (tenant-agnostic mechanism; tenant content lives in the Tenant layer)
**Owner:** Stewards
**Validation priority:** unblocks Module #4 ([Spec 004](../004-tax-compliance-guard/spec.md))
**Version:** 0.1.0
**Last updated:** 2026-06-21

> **Method.** Spec-first (Constitution, Principle 8). Defines *how a tenant declares a jurisdiction and a rule set* in a way that the **Core stays jurisdiction-agnostic** (Constitution, Principle 10). No real jurisdiction, no real rules, no PII, no invented rates.

---

## 1. Why this spec exists (the gate it opens)

[Spec 004](../004-tax-compliance-guard/spec.md) is a stub blocked on three items (its §4). One of them is **B1 — Jurisdiction model**: *"How a tenant declares its jurisdiction and supplies its rule set generically (so the Module stays jurisdiction-agnostic)."*

Without B1, **B3 (Authoritative rule source)** has nowhere structural to land, and the Tax & Compliance Module cannot even formulate what an "obligation" is without either inventing rules (forbidden) or hard-coding Tenant 0's jurisdiction (Constitution, Principle 10 violation).

This spec defines **B1**. It is **Core** — not a Module, not a Tenant profile — because the *mechanism* for declaring a jurisdiction is generic across tenants. The *content* (Tenant 0's jurisdiction, rules, calendar) is tenant-scoped and lives in the Tenant layer, never here.

## 2. Design constraint (binding)

> **The Core must remain jurisdiction-agnostic.** No country code, no tax form, no deadline, no rate, no currency of any specific jurisdiction may appear in the Core's domain, application, or ports. The Core may reference *jurisdictions* as opaque identifiers and *rule sets* as opaque, structured data; it must never *interpret* a specific jurisdiction's content.

This is Constitution Principle 10 in code form. If a future change to this spec wants to introduce jurisdiction-specific behavior, that change is invalid and must instead become a new Module or a new Tenant layer entry.

## 3. Concepts (Core-level, tenant-agnostic)

### 3.1 `JurisdictionProfile` (Tenant layer, NOT Core)

A **Tenant-scoped** declaration that says: *"This tenant operates under this jurisdiction, this fiscal calendar, this currency, and these rule sets."* Loaded as data via `config/tenants/<tenant>.jurisdiction.ts`, just like the existing `TenantConfig` (`config/tenants/tenant-0.ts`). The Core defines the **shape**; the Tenant provides the **values**.

```ts
// Tenant layer (config/tenants/<tenant>.jurisdiction.ts) — illustrative, not authoritative
type JurisdictionRef = {
  countryCode: string;        // ISO 3166-1 alpha-2 (e.g. "CL", "AR") — opaque to Core
  subdivisionCode?: string;   // e.g. state/province, also opaque
};

type FiscalCalendar = {
  fiscalYearStart: { month: number; day: number }; // 1-12, 1-31 — opaque to Core
  filingCadence: "monthly" | "quarterly" | "annual" | "custom";
};

type JurisdictionProfile = {
  jurisdiction: JurisdictionRef;          // opaque identifier
  calendar: FiscalCalendar;                // opaque structure
  currency: string;                        // ISO 4217 — opaque to Core
  ruleSets: RuleSetRef[];                 // references, not embedded content
  effectiveFrom?: string;                  // ISO date — when this profile became active
};
```

The Core knows the **type** `JurisdictionProfile`. The Core does **not** know what `countryCode: "CL"` *means*, what the Chilean fiscal calendar *is*, or what CLP *is*. Those are Tenant-supplied.

### 3.2 `RuleSet` (Tenant layer content)

A **versioned, sourced bundle** of obligations. The Core defines the **shape**; the Tenant (or a designated rule-source provider; see [Spec 010](../010-authoritative-rule-source/spec.md)) supplies the **content**.

```ts
type RuleSetRef = {
  ruleSetId: string;                       // stable, opaque
  version: string;                         // semver or date; opaque to Core
  effectiveFrom: string;                   // ISO date
  source: RuleProvenance;                  // see §3.3
  // Obligations themselves are loaded by the Module, not the Core.
  obligationsUri: string;                  // e.g. "config/rulesets/<tenant>/<ruleset>@<version>.json"
};

type ObligationSpec = {
  obligationId: string;                    // stable, opaque
  humanName: string;                       // human-readable label for alerts
  trigger: {
    onEventType: string;                   // e.g. "PaymentReceived", "RevenueReceived"
    conditions?: Record<string, unknown>;  // opaque predicate
  };
  deadline: {
    kind: "offset-from-trigger" | "fixed-calendar";
    // offset-from-trigger: { daysAfter: number; businessDaysOnly: boolean }
    // fixed-calendar: { month: number; day: number; cadence: FiscalCalendar["filingCadence"] }
  };
  // The system GUARDS; it does not FILE. The action is a human task, not an agent call.
  requiredHumanAction: "notify" | "file" | "pay" | "review";
  provenance: RuleProvenance;              // see §3.3
};
```

### 3.3 `RuleProvenance` (mandatory)

Every rule carries its provenance. **No rule may exist without one.** This is what makes B3 (authoritative source) mechanically enforceable instead of merely aspirational.

```ts
type RuleProvenance = {
  sourceKind: "official-publication" | "legal-advisor-opinion" | "tenant-declared";
  sourceId: string;          // document number, URL, advisor letter ID, etc.
  retrievedAt: string;       // ISO date — when the tenant acquired this content
  verifiedBy: string;        // human identity (Tenant 0 / advisor / etc.)
  notes?: string;            // free text — e.g. "transitional rule for FY26"
};
```

### 3.4 What the Core does **not** do

- Does not interpret `countryCode`. It is opaque.
- Does not interpret `fiscalYearStart.month` beyond `1..12` type-check.
- Does not interpret `obligations[].deadline`. It is opaque.
- Does not know what an "obligation" *means* in any specific jurisdiction.
- Does not compute taxes, file forms, or contact authorities.

### 3.5 What the Core **does** do

- Defines the `JurisdictionProfile`, `RuleSet`, `ObligationSpec`, and `RuleProvenance` types.
- Provides a `JurisdictionPort` (read interface) — load profile + rule sets for a tenant.
- Provides a `JurisdictionRegistry` (Core-internal) — resolves which profile/rules apply for a tenant at a given date.
- Provides a `RuleSetLoaderPort` — fetches referenced rule set content. The default adapter reads from `config/rulesets/<tenant>/...`, but a Tenant may supply an adapter that reads from elsewhere.

## 4. Core / Module / Tenant split (this spec's own)

| Layer | What lives here | What does **not** live here |
|---|---|---|
| **Core** | `JurisdictionProfile`/`RuleSet`/`ObligationSpec`/`RuleProvenance` *types*; `JurisdictionPort`; `RuleSetLoaderPort`; resolution mechanism (which profile+rules apply for a tenant at a date); provenance validation (must be present, dated, human-verified). | Any specific country code, fiscal calendar, currency, rule, deadline, or obligation. |
| **Module (Tax & Compliance, #4)** | The *interpretation* of `ObligationSpec` (deadline arithmetic, business-day rules, alert emission). Reads via the Core's ports. Stays jurisdiction-agnostic — only knows the *shape*. | Hard-coded obligations for any specific jurisdiction. |
| **Tenant** | `config/tenants/<tenant>.jurisdiction.ts` (the values); `config/rulesets/<tenant>/<ruleset>@<version>.json` (the obligation content); `verifiedBy` identity of the human who vouches for the rules. | Code, business logic, or auto-update of rule content. The Tenant *never* silently changes its own rules. |

## 5. Events

The Core emits no jurisdiction-specific events. It emits one generic event when a tenant's jurisdiction profile changes (a Tenant-layer operation, audit-required):

- **`JurisdictionProfileChanged`** `{ tenantId, previousProfileRef?, newProfileRef, actor, occurredAt, provenance }` — lineage standard. The Core does not interpret the *content* of either profile; it only records that a change happened, with provenance.

Rule-set changes are emitted by the Module once it exists (`RuleSetRegistered`, `RuleSetSuperseded`). Out of scope here.

## 6. Non-goals (this spec)

- Inventing rules for any jurisdiction.
- A DSL for obligations. The shape is fixed in §3.2.
- Auto-fetching rules from external sources (the Tenant supplies them; see [Spec 010](../010-authoritative-rule-source/spec.md)).
- Migration/transition logic between rule-set versions. The Module handles that once it exists.
- Multi-jurisdiction-per-tenant in this phase. A Tenant with multiple jurisdictions is split into multiple Tenant IDs (see [Identity](../../docs/identity.md)).

## 7. Conformance

- ✅ No jurisdiction-specific string appears in `@daedalus/core`.
- ✅ All `ObligationSpec` instances in the repository carry a `provenance` (lint-enforceable; see tasks).
- ✅ Loading a tenant without a `JurisdictionProfile` is **not an error** — the tenant simply opts out of jurisdiction-bound modules. Modules that require it (like Tax & Compliance Guard) refuse to activate for that tenant and log a structured `ModuleActivationRefused`.
- ✅ Rule-set version bumps do **not** mutate the prior version; history is append-only (consistent with Event-First, ADR-004).

## 8. Relation to canon

| Reference | How this spec conforms |
|---|---|
| [Constitution, Principle 10](../../memory/constitution.md) | The Core knows the *shape* of a jurisdiction and rule set, never the *content*. Tenant 0's specifics live in `config/tenants/`. |
| [Technical Principles §4](../../memory/technical-principles.md) | Tenant isolation is structural: jurisdiction is a first-class per-tenant artifact. |
| [Identity](../../docs/identity.md) | Multi-tenant safety — a Tenant's jurisdiction cannot leak into another Tenant's resolution. |
| [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md) | `RuleProvenance` is the lineage of a *rule*, complementing the lineage of an *event*. |
| [Spec 004](../004-tax-compliance-guard/spec.md) | Provides B1. Spec 004's Module will consume `JurisdictionPort` + `RuleSetLoaderPort` and emit `ObligationDue`, `ObligationFulfilled`, `ObligationMissed`. |

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Identity](../../docs/identity.md). Foundational Core capability. No real jurisdiction content here.*