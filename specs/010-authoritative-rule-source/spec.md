# Spec 010 — Authoritative Rule Source (Process + Structure)

**Status:** Draft · **STUB** (process + structural pattern, not yet a full spec) · unlocks [Spec 004](../004-tax-compliance-guard/spec.md) B3
**Type:** Cross-cutting specification (governance process + Core structural support)
**Owner:** Stewards + tenant (human accountable)
**Validation priority:** unblocks Module #4; required before Spec 008's `RuleProvenance` carries real weight
**Version:** 0.1.0
**Last updated:** 2026-06-21

> **Method.** Spec-first (Constitution, Principle 8). **Stub**, mirroring [Spec 004](../004-tax-compliance-guard/spec.md) and [Spec 009](../009-policy-engine/spec.md): frames the problem, fixes the boundary, records the blockers. The full spec would need a human process for legal/tax review — this stub holds the place and records the gate.

---

## 1. Why this is a stub and not a spec yet

[Spec 004](../004-tax-compliance-guard/spec.md) §4 B3 names this as a blocker: *"Authoritative rule source. Tax rules must come from an authoritative, dated source per tenant — never invented by the system or by an agent."*

[Spec 008](../008-jurisdiction-model/spec.md) §3.3 gives the rule a **type** (`RuleProvenance`) and a **mandatory** field set, but the *process* by which a Tenant acquires, verifies, and updates rule content is not designed here. That process is what this spec is about — and it is **not** something the system can design alone:

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

- **Refuse to load** any `RuleSet` whose obligations lack `provenance` (covered by [Spec 008](../008-jurisdiction-model/spec.md) J-06).
- **Refuse to load** any `RuleSet` whose version in the file does not match the version in `RuleSetRef` (Spec 008 J-10).
- **Emit `RuleSetRegistered`** with full lineage when a Tenant registers a new RuleSet (covers Spec 008 §5).
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
- A marketplace, registry, or shared rule library across tenants. Each Tenant's rules are its own; shared *mechanism* lives in [Spec 008](../008-jurisdiction-model/spec.md).
- LLM-assisted rule interpretation. The system records what the human supplies.

## 8. Relation to canon

| Reference | Conformance |
|---|---|
| [Constitution Principle 4](../../memory/constitution.md) | Auditability by Default: every rule has a named human + dated source. |
| [Constitution §V](../../memory/constitution.md) | Humans are accountable: the system surfaces what they verified; they decide compliance. |
| [Spec 004 §5](../004-tax-compliance-guard/spec.md) | The 🚩 compliance flag — rule provenance is authoritative-source-only. This spec operationalizes that flag. |
| [Spec 008](../008-jurisdiction-model/spec.md) | Provides the `RuleProvenance` type and the mechanical guard against invention. This spec governs the *process* by which provenance is acquired. |
| [Spec 009](../009-policy-engine/spec.md) | Eventually, the Policy Engine will evaluate obligation policies; those policies' *content* comes from RuleSets governed by this spec. |

---

*Subordinate to the [Constitution](../../memory/constitution.md). Stub only — the process is human; the system can only enforce provenance mechanics and surface gaps. No rule is invented or auto-acquired.*