# Plan 004 — Tax & Compliance Guard (Module)

**Status:** Ratified · implementation plan for [Spec 004](./spec.md) v1.0.0
**Derives from:** [Spec 004](./spec.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../013-jurisdiction-model/spec.md), [Spec 009](../009-policy-engine/spec.md), [Spec 010](../010-authoritative-rule-source/spec.md)
**Version:** 1.0.0
**Last updated:** 2026-06-22

> The `/plan` step for the Tax & Compliance Guard Module. v1.0 is the **guard**, not the engine. The Module owns the obligation lifecycle (due / met / missed), the deadline tracker, the policy integration, and the CLI surface. It owns **no jurisdiction-specific content** — that lives in the Tenant's RuleSet (Spec 010 process) and tax-compliance-policy bundle (Spec 009).

---

## 0. Q resolutions (from Spec 004 §11, §14)

- **Q1 (Module location):** new package `packages/tax-compliance-guard/` → `@daedalus/tax-compliance-guard` (mirrors the package-per-Module precedent: `@daedalus/proposal-generation`, `@daedalus/revenue-visibility`, `@daedalus/opportunity-discovery`).
- **Q2 (business-day arithmetic):** v1.0 uses simple day count. The `businessDaysOnly` flag is preserved on the deadline but the Module does not compute the offset across weekends. A future Spec adds a calendar-tenant-supplied mechanism. v1.0 explicitly defers this.
- **Q3 (default policy):** when the tax-compliance-policy bundle is absent, default to `allow` with `reason: "no-policy-bundle"`. Safe default — `allow` means "notify the founder".
- **Q4 (CLI surface):** 3 commands — `obligations:list`, `obligations:ack`, `obligations:sweep`. Mirrors the per-command-files CLI pattern (Spec 008/009/010).

## 1. Package layout

```
packages/tax-compliance-guard/
  src/
    domain/
      obligation.ts              # type: obligation lifecycle event payloads
    application/
      watch-financial-events.ts   # use case: obligation watcher
      sweep-deadlines.ts         # use case: deadline tracker
      acknowledge-obligation.ts  # use case: emit ObligationMet
      list-obligations.ts        # use case: derived state from event stream
      obligation-state.ts        # pure function: derive pending/met/missed from events
      compute-deadline.ts        # pure function: deadline arithmetic (simple day count)
      evaluate-tax-policy.ts     # use case: invoke Policy Engine per obligation
      deps.ts                    # ModuleDeps: CoreDeps + RuleSetLoaderPort + PolicyEnginePort
      ports/                     # port interfaces if any (none expected for v1.0)
    index.ts                     # curated public contract
  tests/                         # mirror tests/proposal-generation.test.ts pattern
  package.json
  README.md
```

`apps/cli/src/commands/obligations.ts` — 3 CLI commands (per-command-file pattern).

The Module is a **peer** to `@daedalus/proposal-generation` and `@daedalus/revenue-visibility`. It depends on `@daedalus/core` (event substrate + lineage), `@daedalus/jsonl-event-store` (FilesystemRuleSetLoaderAdapter lives in Core but is accessed through the public contract), and consumes the Spec 009 Policy Engine via `@daedalus/core` (which re-exports `evaluateAndRecordPolicy`).

**No external runtime dependencies.** Pure `process.env` (env-var pattern from Plan 008 §4.1).

## 2. The 4 obligation events (Module vocabulary)

The 4 event types from Spec 004 §4 (`ObligationDue`, `ObligationMet`, `ObligationMissed`, `ObligationEvaluationRecorded`) live in `packages/tax-compliance-guard/src/domain/obligation.ts`. The Module emits them via Core's `appendIntents` (mirrors the policy engine's pattern in Spec 009).

`ObligationCoverageGap` is from Spec 010 §12.4; the Module imports its event type from `@daedalus/core` (no duplication).

## 3. The use cases

### 3.1 `watchFinancialEventsUseCase`

Subscribes to the tenant's event stream. For each new event:
1. Find the tenant's active RuleSet via the `JurisdictionPort` (Spec 008).
2. Load each RuleSet's obligations via `RuleSetLoaderPort`.
3. For each obligation whose `trigger.onEventType` matches the event's type:
   a. Compute the `deadline` via `computeDeadline(obligation.deadline, event.occurredAt)`.
   b. Emit `ObligationDue` with full lineage (`causationId = trigger event id`).
   c. Invoke the Policy Engine for the tax-compliance-policy bundle.
   d. Emit `ObligationEvaluationRecorded` with the engine's outcome.
4. If no obligations matched, emit `ObligationCoverageGap` with `reason: "no-rule-matches"`.
5. If all matched obligations are stale, emit `ObligationCoverageGap` with `reason: "all-matching-rules-stale"`.

The watcher can be invoked:
- On every new financial event (e.g. a CLI hook on the existing `revenue:ingest` command, or a wrapper around Spec 008's engine loop).
- On demand via `obligations:sweep --watch`.
- On engine boot (similar to the Workflow Engine's boot sweep).

For v1.0, the simplest integration is: `obligations:list` (CLI command) accepts `--watch` which runs the watcher over the current stream. A future Spec wires it into the event loop.

### 3.2 `sweepDeadlinesUseCase`

Walks the tenant's event stream, derives the live obligation state via `deriveObligationStates` (pure function), and emits `ObligationMissed` for any `pending` obligation whose `dueAt` is in the past. Idempotent: re-running the sweep does NOT re-emit for already-missed obligations (the derivation function tracks state per obligation id).

### 3.3 `acknowledgeObligationUseCase`

Emits `ObligationMet` for a pending obligation. Validates the obligation is actually pending (else throws). Carries the actor's identity from CLI args.

### 3.4 `listObligationsUseCase`

Reads the event stream, derives live state, and returns a structured report (`obligationId`, `dueAt`, `status`, `evaluation`, `ruleSetRef`). Used by the `obligations:list` CLI command.

### 3.5 `evaluateTaxPolicyUseCase`

Convenience wrapper around `evaluateAndRecordPolicy` (from `@daedalus/core` / Spec 009). Loads the tax-compliance-policy bundle via `PolicyStorePort`, runs the engine, and returns the decision. If the bundle is absent, defaults to `allow` with `reason: "no-policy-bundle"`.

## 4. Pure functions (no I/O)

- `computeDeadline(deadlineSpec, triggerTime): string` — ISO timestamp. v1.0 supports both `offset-from-trigger` and `fixed-calendar`. Business-day arithmetic deferred.
- `deriveObligationStates(events): ObligorState[]` — given a tenant's event stream, returns the current state of every obligation. Pure function: same input → same output. The Module uses this in `sweepDeadlinesUseCase` and `listObligationsUseCase`.

## 5. The Module's public contract (ADR-004)

`packages/tax-compliance-guard/src/index.ts`:

```ts
// Event type constants + payload types
export { ObligationDue, ObligationMet, ObligationMissed, ObligationEvaluationRecorded } from "./domain/obligation.ts";
export type { ObligationDuePayload, ObligationMetPayload, ObligationMissedPayload, ObligationEvaluationRecordedPayload } from "./domain/obligation.ts";

// Use cases
export { watchFinancialEventsUseCase } from "./application/watch-financial-events.ts";
export { sweepDeadlinesUseCase } from "./application/sweep-deadlines.ts";
export { acknowledgeObligationUseCase } from "./application/acknowledge-obligation.ts";
export { listObligationsUseCase } from "./application/list-obligations.ts";
export { evaluateTaxPolicyUseCase } from "./application/evaluate-tax-policy.ts";

// Pure helpers
export { computeDeadline } from "./application/compute-deadline.ts";
export { deriveObligationStates, type ObligorState } from "./application/obligation-state.ts";

// Module deps shape
export type { TaxComplianceDeps } from "./application/deps.ts";
```

No adapters (the Module consumes Core adapters directly: `JsonlEventStoreAdapter`, `FilesystemRuleSetLoaderAdapter`, `InMemoryPolicyStore` / `FilesystemPolicyStore`). Adapters for tax-compliance-specific data are not needed in v1.0 (the Module owns no persistent state of its own; everything is derived from the event stream).

## 6. CLI commands (3 new)

`apps/cli/src/commands/obligations.ts`:

- `obligations:list --tenant <t> [--watch]` — list live obligations. With `--watch`, runs the watcher over the current stream first.
- `obligations:ack --tenant <t> --obligation <id> --due-event <id> [--notes <n>]` — emit `ObligationMet`.
- `obligations:sweep --tenant <t>` — run the deadline tracker explicitly.

Each follows the existing CLI pattern (parse + dispatch + render). The Module's use cases are imported via `@daedalus/tax-compliance-guard`; the CLI is a thin composition root.

## 7. Test strategy

`tests/tax-compliance-guard.test.ts` — 9 cases (the ACs from Spec 004 §11):

1. **AC-1** trigger match: `PaymentReceived` → `ObligationDue` with computed `dueAt`.
2. **AC-2** deadline miss: past `dueAt` → `ObligationMissed`.
3. **AC-3** ack: `obligations:ack` → `ObligationMet`.
4. **AC-4** policy allow: tax-compliance-policy with allow rule → `ObligationEvaluationRecorded` outcome=allow.
5. **AC-5** policy escalate: tax-compliance-policy with escalate rule → `outcome=escalate, gateRef=...`.
6. **AC-6** no policy = default allow: no bundle → `outcome=allow, reason="no-policy-bundle"`.
7. **AC-7** coverage gap: no matching obligation → `ObligationCoverageGap`.
8. **AC-8** tenant isolation: cross-tenant lookups return nothing.
9. **AC-9** replay determinism: replay the same event stream → same obligation events in the same order.

Plus `tests/cli-obligations.test.ts` — CLI integration for the 3 commands (mirrors Spec 008/009/010's CLI test pattern).

## 8. Conformance (binding)

- ✅ `npm test` is green.
- ✅ The Module adds **no jurisdiction-specific content** to `packages/core/src/**`. The existing `npm run lint:core-jurisdiction-agnostic` continues to pass.
- ✅ The Module's new events (`ObligationDue`, `ObligationMet`, `ObligationMissed`, `ObligationEvaluationRecorded`) carry full lineage per ADR-004.
- ✅ `ObligationMet` is human-only (CLI is the only path).
- ✅ No auto-refresh, no auto-ack, no auto-resolution. The human decides.
- ✅ The 🚩 Compliance Flag (Spec 004 §13) holds: the system guards; the human claims compliance.

## 9. Definition of done (v1.0)

- ✅ `packages/tax-compliance-guard/` exists. `package.json` declares no external deps; `dependencies: { "@daedalus/core": "*" }`.
- ✅ Domain types + 5 use cases + 2 pure helpers shipped.
- ✅ `packages/tax-compliance-guard/src/index.ts` exports the curated contract.
- ✅ 3 new CLI commands (`obligations:list`, `obligations:ack`, `obligations:sweep`).
- ✅ `tests/tax-compliance-guard.test.ts` covers 9 cases (all green).
- ✅ `tests/cli-obligations.test.ts` covers CLI integration.
- ✅ No new Core events beyond the 4 obligation types (the rest — `ObligationCoverageGap` — comes from Spec 010, which already shipped).
- ✅ `npm test` is green: 153 → ~165 tests + 4 lint scripts.
- ✅ The `lint:core-jurisdiction-agnostic` script still passes (the Module adds no jurisdiction terms to Core).
- ✅ Docs: `docs/identity.md` records "Tax & Compliance Guard shipped"; `roadmap.md` flips Phase 3 capability as built (Phase 3 still has the agent-runtime follow-on).

## 10. Out of scope (binding — forward-planning only)

- Business-day calendar arithmetic (the `businessDaysOnly` flag is preserved but not honored in v1.0).
- A DSL for obligations (the shape is fixed; richer languages are future).
- A multi-jurisdiction-per-tenant model (Tenants with multiple jurisdictions split into multiple Tenant IDs).
- LLM-assisted rule interpretation.
- SII integration, PDF generation, form filling, tax filing.
- A visual obligation editor. RuleSet JSON is the contract.
- An "obligation dashboard" in ATLAS. Forward Spec.

## 11. Sequencing

- **Phase A (Domain types + pure helpers) and B (Use cases) are independent** — can land together.
- **Phase C (CLI commands) depends on A + B.**
- **Phase D (Tests + conformance) depends on A + B + C.**
- **Phase E (Docs + unblock) depends on D.**

T-01..T-20 are tracked in tasks.md.