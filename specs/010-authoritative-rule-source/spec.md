# Spec 010 — Authoritative Rule Source (Process + Structure)

**Status:** Ratified · **process + structural pattern** · build authorized
**Type:** Cross-cutting specification (governance process + Core structural support)
**Owner:** Stewards + tenant (human accountable)
**Validation priority:** unblocks Module #4; required before [Spec 013's](../013-jurisdiction-model/spec.md) `RuleProvenance` carries real weight
**Version:** 1.0.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). Upgraded from STUB to Ratified v1.0. The **mechanical** parts (refuse to load rules without provenance; version mismatch; `validateProvenance` + `FilesystemRuleSetLoaderAdapter`) shipped in PR #35 (Spec 013 J-06 / J-10). This v1.0 ratifies the **process** (R1), the **source artifact format** (R2), the **default staleness policy** (R3), and the **conflict resolution rule** (R4), plus four Core events (`RuleSetRegistered`, `RuleSetSuperseded`, `RuleSetStale`, `ObligationCoverageGap`) that surface gaps and supersedes to Module + Tenant. The process is still human; the system can only enforce provenance mechanics and surface gaps. No rule is invented or auto-acquired.

---

## 1. Why this is a stub and not a spec yet

[Spec 004](../004-tax-compliance-guard/spec.md) §4 B3 names this as a blocker: *"Authoritative rule source. Tax rules must come from an authoritative, dated source per tenant — never invented by the system or by an agent."*

[Spec 013](../013-jurisdiction-model/spec.md) §3.3 gives the rule a **type** (`RuleProvenance`) and a **mandatory** field set, but the *process* by which a Tenant acquires, verifies, and updates rule content is not designed here. That process is what this spec is about — and it is **not** something the system can design alone:

- **Who counts as "authoritative"?** A government gazette? A licensed advisor's opinion? A tenant's own interpretation of public law? Each tenant may answer differently.
- **How is staleness detected?** Rules drift. The system can flag dates; the human must decide when a rule needs refresh.
- **What happens when rules conflict?** Two jurisdictions, two advisors, two interpretations. The system can record both; the human must adjudicate.

These are human-and-process questions, not Core-engineering questions. Stubbing is honest.

## 2. Problem framing (the durable part)

A tenant operating in any regulated domain (tax, labor, data protection, financial reporting) **must** be able to show that the rules its system enforced were *not invented by the system*. The system is a guard, not an oracle.

Concretely, this means:

- Every rule in the system traces to a **named human** (`verifiedBy`), a **dated source** (`retrievedAt`, `sourceId`), and a **kind of source** (`sourceKind`).
- The system **never** auto-updates a rule. A new version is a new file with new provenance, registered as a new `RuleSet` event.
- The system **never** invents a rule. If no rule exists for an obligation, the system emits `ObligationCoverageGap` and escalates; it does not silently fill the gap.
- The system **never** claims compliance. It claims *"these are the rules you verified at these dates."* The human claims compliance.

This is Constitution Principle 4 (*Auditability by Default*) and §V (*Humans are accountable*) applied to rule content, not just events.

## 3. Intended boundary (Core / Module / Tenant / External)

| Layer | What lives here |
|---|---|
| **External (per tenant)** | The **authoritative source itself** — a government publication, a tax advisor's letter, a legal opinion. **Not in the repo. Not in the Core.** The Tenant holds the artifact (or its metadata) out-of-band. |
| **Tenant layer** | A **RuleSet registration**: the obligation content (`ObligationSpec[]`) plus its `RuleProvenance` referencing the external source. Loaded by the Core's `RuleSetLoaderPort`. |
| **Module** | The Module that interprets obligations (Tax & Compliance Guard for tax/labor; later modules for other domains) reads `RuleSet`s and emits obligation events. The Module never adds or modifies obligations. |
| **Core** | The `RuleProvenance` type, the `RuleSetLoaderPort`, and a single rule: **rules without provenance do not load.** This is the mechanical guard against invention. |

The system **never** imports rule content from the internet, a scraping service, an LLM, or an agent. Acquisition is a human act; the system records what the human supplies.

## 4. What the system MUST do (binding, even at stub level)

- **Refuse to load** any `RuleSet` whose obligations lack `provenance` (covered by [Spec 013](../013-jurisdiction-model/spec.md) J-06).
- **Refuse to load** any `RuleSet` whose version in the file does not match the version in `RuleSetRef` (Spec 013 J-10).
- **Emit `RuleSetRegistered`** with full lineage when a Tenant registers a new RuleSet (covers Spec 013 §5).
- **Emit `RuleSetSuperseded`** when a Tenant activates a new version; the old version remains queryable (audit).
- **Surface `RuleSetStale`** as a *notification* (not a block) when `retrievedAt` exceeds a Tenant-supplied staleness threshold. The Tenant decides what to do.
- **Never silently change** a Tenant's active RuleSet on the Tenant's behalf.

## 5. What the system MUST NOT do

- **Invent** a rule. If asked to evaluate an obligation with no rule, emit `ObligationCoverageGap` and escalate.
- **Auto-fetch** rules from external sources on the Tenant's behalf.
- **Auto-update** a rule when "the law changed." The Tenant must re-acquire, re-verify, and re-register.
- **Treat a rule as authoritative** without a `verifiedBy` human identity.

## 6. Blockers (must clear before a full spec)

| # | Blocker | Owner |
|---|---|---|
| **R1** | **Tenant process design.** How does a Tenant (founder + advisor) actually acquire, format, and verify a rule? Out-of-band; human process. | Tenant + legal/tax |
| **R2** | **Storage of source artifacts.** Is `sourceId` a URL? A document hash? A reference to an out-of-repo file? The format constrains what the system can verify. | Tenant + Stewards |
| **R3** | **Staleness policy.** Default staleness thresholds per `sourceKind` (e.g. "tax rules older than 12 months → `RuleSetStale`"). These are Tenant-supplied defaults; the system needs a baseline. | Stewards (baseline) + Tenant (overrides) |
| **R4** | **Conflict resolution.** When two RuleSets apply to the same obligation (e.g. national + regional tax), the system needs a deterministic precedence rule. Likely: most-specific wins; tie → escalate. **TBD with evidence from a real jurisdiction.** | Stewards + legal/tax |

## 7. Out of scope for now

- A full spec, design, or implementation.
- A scraping/integration pipeline of any kind. The system does not acquire rules.
- A marketplace, registry, or shared rule library across tenants. Each Tenant's rules are its own; shared *mechanism* lives in [Spec 013](../013-jurisdiction-model/spec.md).
- LLM-assisted rule interpretation. The system records what the human supplies.

## 8. Relation to canon

| Reference | Conformance |
|---|---|
| [Constitution Principle 4](../../memory/constitution.md) | Auditability by Default: every rule has a named human + dated source. |
| [Constitution §V](../../memory/constitution.md) | Humans are accountable: the system surfaces what they verified; they decide compliance. |
| [Spec 004 §5](../004-tax-compliance-guard/spec.md) | The 🚩 compliance flag — rule provenance is authoritative-source-only. This spec operationalizes that flag. |
| [Spec 013](../013-jurisdiction-model/spec.md) | Provides the `RuleProvenance` type and the mechanical guard against invention. This spec governs the *process* by which provenance is acquired. |
| [Spec 009](../009-policy-engine/spec.md) | Eventually, the Policy Engine will evaluate obligation policies; those policies' *content* comes from RuleSets governed by this spec. |

---

## 9. Process for the founder (R1 resolution, binding)

This is the recommended process the founder follows to acquire, verify, and register a real rule. The system does not automate any of it. Each step is a human act; the system records what the human supplies.

### 9.1 Sourcing

1. **Identify the obligation.** The Tax & Compliance Module (Spec 004) emits `ObligationDue` (or `ObligationExpected`) for an obligation it cannot evaluate (no rule, or no current rule). The founder reads the event's `obligationId` and `humanName`.
2. **Locate the authoritative source.** Per [Constitution §V](../../memory/constitution.md) (Humans are accountable) and [Spec 004 §5](../004-tax-compliance-guard/spec.md) (the 🚩 compliance flag), the source must be either:
   - An **official publication** (government gazette, regulator's circular, court ruling) — `sourceKind: "official-publication"`.
   - A **licensed advisor's opinion** (tax counsel letter, legal memo) — `sourceKind: "legal-advisor-opinion"`.
   - A **tenant's own interpretation** of public law (founder's reading of a regulation) — `sourceKind: "tenant-declared"`.
   The founder chooses the kind and supplies `sourceId` (a stable reference; see §10).
3. **Acquire the source artifact.** The artifact is held by the founder out-of-band (paper file, email, government website bookmark, advisor's signed letter, etc.). **Not in the repo.** The system never imports rule content from the internet, a scraping service, an LLM, or an agent.

### 9.2 Formatting

4. **Translate the source into rule shape.** The founder (or their advisor) writes the rule as an `ObligationSpec` per [Spec 013 §3.2](../013-jurisdiction-model/spec.md). The shape is fixed; richer languages (a DSL) are explicit future.
5. **Wrap the rule(s) in a `RuleSet`.** A `RuleSet` is a versioned, named bundle of one or more `ObligationSpec`s. The founder chooses the `version` (semver or date), the `effectiveFrom` date, the `obligationsUri` (a file path the system can read), and the `RuleProvenance` describing who verified it.

### 9.3 Verification

6. **Verify by a named human.** The founder (or the founder's advisor) sets `verifiedBy` to their own name (or the advisor's name). This is a human identity; the system never invents it. The `verifiedBy` field is **PII** and lives in `.env` (gitignored) per [Spec 013 Plan §4.1](../013-jurisdiction-model/plan.md). The default placeholder is `"<founder>"`; the real value comes from `process.env.TENANT_0_VERIFIED_BY` (and analogous for advisors).
7. **Record the source's `retrievedAt` date.** This is the date the founder (or advisor) *acquired* the source, not the date the source was published. A 2018 regulation retrieved in 2026 has `retrievedAt: "2026-XX-XX"`.
8. **Set `sourceId` to a stable reference.** See §10 for the format.

### 9.4 Registration

9. **Write the RuleSet JSON to `config/rulesets/<tenant>/<ruleSetId>@<version>.json`.** The file must satisfy the conformance check (`scripts/check-rulesets-have-provenance.mjs`, wired into `npm test`).
10. **Emit `RuleSetRegistered`** (the founder, or a CLI helper, calls a Core use case) to record the registration in the tenant's event stream with full lineage. See §12.

### 9.5 Refresh (R3, ongoing)

11. **The system surfaces `RuleSetStale`** when `retrievedAt` exceeds the Tenant-supplied staleness threshold for its `sourceKind` (see §11). The founder decides whether to refresh, replace, or override the threshold.
12. **The system never auto-refreshes.** A refresh is a new `RuleSetRegistered` event with a new `retrievedAt`, a new `version`, and new provenance. The old version remains in the audit trail.
13. **The system never changes a rule silently.** A rule that becomes wrong is a *new* rule (new `version`, new provenance), not an edit.

### 9.6 Adjudication (R4, when two RuleSets apply)

14. **When two RuleSets apply to the same obligation** (e.g. national + regional tax), the system uses **most-specific wins** (see §12.4). The founder may escalate to a chosen advisor for an opinion that supersedes both.

## 10. `sourceId` format (R2 resolution, binding)

`sourceId` is the founder's reference to the authoritative source. The system does not parse it; it is opaque. Conventions per `sourceKind`:

- `official-publication`: a stable URL to the publication's authoritative copy (e.g. `https://www.sii.cl/normativa/...`), OR a document identifier (e.g. `SII-CIRC-2024-123`). URL is preferred when available.
- `legal-advisor-opinion`: the advisor's letter ID (e.g. `LETTER-2026-03-15-AZ`).
- `tenant-declared`: a reference to the founder's own reading (e.g. `FOUNDER-READING-2026-Q1-IVA`).

The system stores the string verbatim. It does not fetch, parse, or verify the URL. The founder's `verifiedBy` is the human accountability for the source's contents.

## 11. Default staleness policy (R3 resolution, binding)

The system emits `RuleSetStale` (a notification, not a block) when a RuleSet's `retrievedAt` exceeds a per-`sourceKind` threshold. Defaults:

| `sourceKind` | Default staleness threshold |
|---|---|
| `official-publication` | 12 months |
| `legal-advisor-opinion` | 6 months |
| `tenant-declared` | 3 months |

The thresholds are **Tenant-overridable** via env vars (per [Spec 013 Plan §4.1](../013-jurisdiction-model/plan.md)):

- `TENANT_0_STALENESS_OFFICIAL_PUBLICATION_MONTHS` (default 12)
- `TENANT_0_STALENESS_LEGAL_ADVISOR_OPINION_MONTHS` (default 6)
- `TENANT_0_STALENESS_TENANT_DECLARED_MONTHS` (default 3)

The system only emits `RuleSetStale` — it does **not** suppress a rule on staleness. The Tenant decides what to do (refresh, replace, override, ignore).

## 12. Core events (added in v1.0)

The system emits these four events. They carry full lineage per [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md). None of them modifies rules; they only record.

### 12.1 `RuleSetRegistered`

Emitted by the founder (or a Core use case invoked by a CLI command) when a new RuleSet is registered. The event's lineage preserves the founder's identity (`actor`) and the rule's provenance.

```ts
RuleSetRegistered {
  tenantId, actor, occurredAt, causationId, correlationId,
  payload: {
    ruleSetId, version, effectiveFrom,
    obligationsUri,      // for re-load via the loader
    ruleCount,           // number of obligations in the set
    provenance,          // the RuleProvenance from the file
  }
}
```

### 12.2 `RuleSetSuperseded`

Emitted when a new version of a RuleSet activates. The old version remains queryable for audit. The new `RuleSetRegistered` event and the `RuleSetSuperseded` event share `correlationId` so the audit trail can link them.

```ts
RuleSetSuperseded {
  tenantId, actor, occurredAt, causationId, correlationId,
  payload: {
    ruleSetId,
    previousVersion,
    newVersion,
    previousEffectiveFrom,
    newEffectiveFrom,
  }
}
```

### 12.3 `RuleSetStale`

Emitted by a Core sweep (run on engine boot or on a schedule) when a RuleSet's `retrievedAt` exceeds the staleness threshold for its `sourceKind`. A *notification*, not a block — the Tenant decides.

```ts
RuleSetStale {
  tenantId, actor: "system", occurredAt,
  payload: {
    ruleSetId,
    version,
    sourceKind,
    retrievedAt,
    ageMonths,            // computed
    thresholdMonths,      // from env or default
  }
}
```

### 12.4 `ObligationCoverageGap`

Emitted when the Tax & Compliance Module (Spec 004) — or any Module that consumes RuleSets — finds an obligation it cannot evaluate. The system does **not** invent a rule; it surfaces the gap.

```ts
ObligationCoverageGap {
  tenantId, actor, occurredAt, causationId, correlationId,
  payload: {
    obligationId,
    obligationHumanName,
    reason: "no-rule-matches" | "all-matching-rules-stale" | "conflicting-rules-no-precedence",
    candidateRuleSets,    // the (possibly conflicting) rule sets the system considered
  }
}
```

When `reason` is `"conflicting-rules-no-precedence"`, the candidate rule sets are listed and the founder (or their advisor) adjudicates. The system does **not** pick a winner in ambiguous cases; it surfaces and escalates.

## 13. Conflict resolution (R4 resolution, binding)

When two RuleSets apply to the same obligation (e.g. national + regional tax), the system uses **most-specific wins** with the following precedence:

1. **RuleSet with the most-specific `jurisdiction`** wins (e.g. `countryCode + subdivisionCode` beats `countryCode` only).
2. **If jurisdictions tie, the most-recent `effectiveFrom`** wins.
3. **If still tied, the system emits `ObligationCoverageGap` with `reason: "conflicting-rules-no-precedence"`** and escalates. The system does **not** pick a winner.

This rule is mechanical and auditable. The founder (or advisor) resolves by either: (a) registering a new RuleSet that is more specific, (b) superseding one of the conflicting RuleSets, or (c) accepting the escalation as a human task.

## 14. Conformance (binding)

- ✅ Every RuleSet's `provenance` is mandatory and validated (Spec 013 §3.3 + §12).
- ✅ The system **never** invents a rule. If no rule matches, `ObligationCoverageGap` is emitted.
- ✅ The system **never** auto-fetches rule content. Acquisition is a human act.
- ✅ The system **never** auto-updates a rule. A refresh is a new `RuleSetRegistered`.
- ✅ The system **never** claims compliance. It claims "these are the rules you verified at these dates." The human claims compliance (Constitution §V).
- ✅ The default staleness policy is overridable per-tenant via env vars (Plan 008 §4.1).

## 15. Non-goals (binding for v1.0)

- A scraping/integration pipeline of any kind.
- A marketplace, registry, or shared rule library across tenants.
- LLM-assisted rule interpretation.
- A DSL for rules (Spec 013 §6 already defers; this spec inherits that deferral).
- A visual rule-authoring UI. RuleSet JSON files are the contract.
- A built-in advisor / tax-counsel marketplace.

## 16. Out of scope (deferred)

- A live advisor integration (e.g. fetching a tax opinion from a 3rd party) — explicit future Spec.
- A per-jurisdiction rule template library (e.g. "starter pack for Chile IVA") — the founder writes their own; we ship a stub-by-default pattern via the `placeholder content` design (Spec 013 §3.2 + §4) but do not curate templates.
- A "diff between rule versions" UI — a future Spec, gated on richer rule histories.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Spec 013](../013-jurisdiction-model/spec.md) (provenance), and [Spec 004](../004-tax-compliance-guard/spec.md) (consumer). The process is human; the system enforces provenance mechanics and surfaces gaps. No rule is invented or auto-acquired.*