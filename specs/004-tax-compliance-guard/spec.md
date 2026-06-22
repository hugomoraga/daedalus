# Spec 004 — Tax & Compliance Guard (Module)

**Status:** Ratified · v1.0.0 shipped (governance PR #52, impl PR #53)
**Type:** Module specification (reusable capability over tenant-scoped data)
**Owner:** Stewards
**Tenant of origin:** [Tenant 0 — Founder Profile](../../blueprints/tenants/tenant-0-founder-profile.md)
**Validation priority:** #4 (see [Roadmap](../../docs/roadmap.md)) · shipped in **Phase 3** (policy-shaped)
**Version:** 1.0.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). The original v0.5.0 stub
> held the place and recorded 4 unblockers (B1..B4). All four shipped:
>
> - **B1** [Spec 008 — Jurisdiction Model](../008-jurisdiction-model/spec.md) (PR #35) — Core types, ports, adapters, lint scripts, env-var pattern.
> - **B2** [Spec 009 — Policy Engine](../009-policy-engine/spec.md) (PR #47) — Core types, 3-outcome verdict, default evaluator, use case, adapters, `PolicyDecisionRecorded`, lint.
> - **B3** [Spec 010 — Authoritative Rule Source](../010-authoritative-rule-source/spec.md) (PR #50) — 4 Core events, 4 use cases, default staleness config, 3 CLI commands, lint.
> - **B4** Spec 001 Revenue Visibility v1 — `RevenueConfirmed`, `RevenueReceived`, `ExpenseRegistered`, `FinancialSummary` (PR #29).
>
> v1.0 promotes the stub to a full spec: 4 obligation lifecycle events + 1 shared coverage-gap event (Core), 5 use cases, 2 pure helpers, 3 CLI commands, 9 acceptance criteria.

---

## 1. Why this module exists

Realizes **Tenant 0 Pain — taxes & compliance**: the founder must meet tax and regulatory obligations without that consuming the attention Daedalus exists to protect ([Identity](../../docs/identity.md) §3). The module's intent is to **watch obligations and surface them in time**, not to compute or file official taxes.

- **It is:** a *guard* — it flags obligations, deadlines, and risks for human action.
- **It is NOT:** a tax engine, an accountant, a system of record for compliance, or a filing tool. It does **not** compute definitive taxes and does **not** integrate with any tax authority (e.g. SII) in any near phase.

This boundary is consistent with Revenue Visibility (#2), which is explicitly *not* official accounting and explicitly defers all tax to this module (Spec 001 §10).

---

## 2. Core / Module / Tenant split

- **Core:** event substrate, lineage, tenant isolation, the Policy Engine (Spec 009), the Authoritative Rule Source primitives (Spec 010). Consumes existing financial events (`InvoiceIssued`, `PaymentReceived`).
- **Module:** generic obligation-watching logic + the obligation/deadline concepts + 4 Module-owned events + 5 use cases + the CLI surface. The Module is **policy-shaped** (it consumes the Spec 009 Policy Engine) and **rule-source-aware** (it consumes the Spec 010 RuleSet registry).
- **Tenant:** the **jurisdiction**, applicable rules, rates, thresholds, and calendar. **All jurisdiction-specific content lives here, never in the Module or the Core.** This is the line that keeps the Core generic.

---

## 3. The 4 obligation lifecycle events (Module-owned)

| Event | When | Payload (key fields) |
|---|---|---|
| **`ObligationDue`** | When a financial event matches a registered obligation | `obligationId`, `obligationHumanName`, `triggerEventId`, `triggerEventType`, `dueAt`, `ruleSetId`, `ruleSetVersion`, `requiredHumanAction`, `provenance` |
| **`ObligationMet`** | **Human only** — emitted by `obligations:ack`. System never auto-acks. | `obligationId`, `dueEventId`, `actor`, `notes?` |
| **`ObligationMissed`** | Sweep finds a `pending` obligation past `dueAt` (idempotent) | `obligationId`, `dueEventId`, `dueAt`, `detectedAt` |
| **`ObligationEvaluationRecorded`** | After the policy engine evaluates the obligation (or `no-policy-bundle` default) | `obligationId`, `dueEventId`, `outcome`, `reason`, `policyRef`, `ruleId`, `gateRef?` |

Plus the **shared** Core event from Spec 010 §12.4:

| Event | When |
|---|---|
| **`ObligationCoverageGap`** | Watcher cannot evaluate a trigger — no rule matches, or all matching rules are stale |

All five events carry full lineage per ADR-004 (eventId, tenantId, actor, occurredAt, causationId, correlationId, payload).

---

## 4. The 5 use cases

| Use case | Purpose |
|---|---|
| **`watchFinancialEventsUseCase`** | Subscribes to the tenant's stream. For each new financial event: load registered RuleSets, find matching obligations, emit `ObligationDue` + `ObligationEvaluationRecorded`. If no match, emit `ObligationCoverageGap`. |
| **`sweepDeadlinesUseCase`** | Derives live state from the event stream. Emits `ObligationMissed` for any `pending` obligation whose `dueAt` is in the past. Idempotent — re-running does NOT re-emit for already-met/missed obligations. |
| **`acknowledgeObligationUseCase`** | **Human-only path.** Emits `ObligationMet` after validating the obligation is `pending`. Throws `ObligationNotPending` (or `UnknownObligation`) for invalid states. |
| **`listObligationsUseCase`** | Reads the stream + derives state. Returns the structured live-state report for the CLI. |
| **`evaluateTaxPolicyUseCase`** | Wraps Core's `evaluateAndRecordPolicy` (Spec 009) with the tax-compliance default: when the bundle is absent, returns `outcome=allow`, `reason="no-policy-bundle"`, `policyRef=null`. Does NOT emit events — the watcher emits `ObligationEvaluationRecorded` with proper lineage. |

Plus 2 pure helpers (`computeDeadline`, `deriveObligationStates`) that have no I/O.

---

## 5. The 3 CLI commands

```
obligations:list  --tenant <id> [--watch]
obligations:ack   --tenant <id> --obligation <id> --due-event <id> [--notes <n>]
obligations:sweep --tenant <id>
```

- `obligations:list` — show the live state of every obligation. With `--watch`, runs the watcher over the most recent event of each known financial trigger type first (idempotent).
- `obligations:ack` — the **only** path to `ObligationMet`. Throws `ObligationNotPending` / `UnknownObligation` for invalid states (CLI exits with code 2).
- `obligations:sweep` — runs `sweepDeadlinesUseCase` and prints which obligations were newly missed.

---

## 6. Default policy behavior (binding)

When the `tax-compliance-policy` bundle is **absent** for the tenant, the Module defaults to:

```json
{
  "outcome": "allow",
  "reason": "no-policy-bundle",
  "policyRef": null,
  "ruleId": null
}
```

The watcher still emits `ObligationEvaluationRecorded` so the audit trail is complete. The default is **safe** — `allow` means "notify the founder", not "suppress the obligation".

---

## 7. Acceptance criteria

| # | Criterion |
|---|---|
| **AC-1** | `PaymentReceived` + matching obligation → `ObligationDue` with `dueAt = triggerTime + offset` (or computed `fixed-calendar`). |
| **AC-2** | `pending` obligation past `dueAt` → `ObligationMissed`. Re-running the sweep is idempotent (no duplicate events). |
| **AC-3** | `obligations:ack` on a `pending` obligation → `ObligationMet`. Re-ack throws `ObligationNotPending`. Ack of unknown id throws `UnknownObligation`. |
| **AC-4** | Tax-compliance-policy with `allow` rule → `ObligationEvaluationRecorded` `outcome=allow`. |
| **AC-5** | Tax-compliance-policy with `escalate` rule → `outcome=escalate`, `gateRef=<rule.escalateTo>`. |
| **AC-6** | No policy bundle → `outcome=allow`, `reason="no-policy-bundle"`, `policyRef=null`. |
| **AC-7** | No matching obligation → `ObligationCoverageGap reason="no-rule-matches"` (lineage follows the trigger). |
| **AC-8** | Tenant isolation: cross-tenant triggers emit `ObligationCoverageGap` with no candidates; the other tenant's stream has no `ObligationDue` from this Module. |
| **AC-9** | Replay determinism: same event stream + same deps → same obligation events in the same order with the same `triggerEventId` / `dueAt` / `causationId` lineage. |

---

## 8. Process — the founder's side (the only durable rules)

1. **Add a rule set.** Place a JSON file at `config/rulesets/<tenant>/<ruleSetId>@<version>.json`. Shape matches `RuleSet` (Spec 008 §3.2). Every obligation and the ref must carry `provenance` (Spec 010 §9.4).
2. **Register the rule set.** `rules:register --tenant <id> --ruleset "<ruleSetId>@<version>" --file "config/rulesets/<tenant>/<file>.json"`. Lint (`check-rulesets-have-provenance`) refuses the registration if provenance is missing.
3. **Author the tax-compliance-policy bundle.** Same shape as every Spec 009 policy: `ref + rules`. Each rule matches on `PolicyAction` (actionType / context fields) and emits one of the 3 outcomes. Place at `config/policies/<tenant>/tax-compliance@<version>.json`.
4. **Register the policy.** `policies:register` (Spec 009) emits `PolicyDecisionRecorded` lineage for every evaluation.
5. **Run the watcher.** `obligations:list --watch` or (future Spec) wire into the event loop. The watcher emits `ObligationDue` + `ObligationEvaluationRecorded` for every match.
6. **Sweep deadlines.** `obligations:sweep` periodically. Idempotent.
7. **Ack obligations.** `obligations:ack --obligation <id> --due-event <id>`. Human only.
8. **Never invent a rule.** The Module does not fabricate obligations; the founder (or their legal/tax counsel) authors them with verified provenance.

---

## 9. Resolved questions (from Plan §0)

- **Q1 (Module location):** new package `packages/tax-compliance-guard/` → `@daedalus/tax-compliance-guard`. Peer to `@daedalus/proposal-generation` and `@daedalus/revenue-visibility`.
- **Q2 (business-day arithmetic):** deferred. v1.0 uses simple day count. `businessDaysOnly` is preserved on the spec but NOT honored; future Spec adds a calendar-tenant-supplied mechanism.
- **Q3 (default policy):** absent bundle → `outcome=allow`, `reason="no-policy-bundle"`. Safe default — `allow` means "notify the founder".
- **Q4 (CLI surface):** 3 commands — `obligations:list`, `obligations:ack`, `obligations:sweep`.

---

## 10. Out of scope (deferred to future Specs)

- Business-day calendar arithmetic.
- A DSL for obligations (the shape is fixed).
- Multi-jurisdiction-per-tenant (tenants with multiple jurisdictions split into multiple tenant IDs).
- LLM-assisted rule interpretation.
- SII integration, PDF generation, form filling, tax filing.
- A visual obligation editor. RuleSet JSON is the contract.
- An ATLAS obligation dashboard. Forward Spec.

---

## 11. 🚩 Compliance Flag (binding)

This module touches legal/tax obligations directly. The rule provenance is authoritative-source-only. The founder is accountable for filings (**Human Governance, Article V**) — the system **guards**, it does not **decide** compliance. Any future Spec that changes this boundary requires an ADR.

---

## 12. Conformance (binding)

- ✅ `npm test` is green: 153 → 164 tests + 4 lint scripts.
- ✅ The Module adds **no jurisdiction-specific content** to `@daedalus/core` (`lint:core-jurisdiction-agnostic` passes).
- ✅ All 5 obligation-related events carry full lineage per ADR-004.
- ✅ `ObligationMet` is human-only (CLI is the only path).
- ✅ No auto-refresh, no auto-ack, no auto-resolution. The human decides.
- ✅ RuleSets must carry provenance (`lint:rulesets-have-provenance`); policies must too (`lint:policies-have-provenance`).
- ✅ RuleSets age-checked (`lint:rule-source-staleness`).
- ✅ v1.0 is buildable end-to-end; all 4 unblockers built.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and [Identity](../../docs/identity.md). Implementation plan: [plan.md](./plan.md). Tasks: [tasks.md](./tasks.md) (SHIPPED).*
