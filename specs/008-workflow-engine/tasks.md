# Tasks — Workflow Engine

**Status:** Build **authorized** — [Spec 008](./spec.md) ratified (v0.2.0) and [ADR-006](../../governance/decisions/ADR-006-adopt-workflow-engine.md) accepted on 2026-06-21.
**Derives from:** Spec 008 + Plan 008
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.2.0
**Last updated:** 2026-06-21

> The `/tasks` step for the Workflow Engine. Tasks map 1:1 to Spec 008 acceptance criteria and Plan 008 build steps. Build authorized — implementation begins in branch `024-workflow-engine-scaffold`.

---

## 1. Reality check (verified, not assumed)

- **v0 status: planning.** No code yet. `packages/workflow-engine/` does not exist. The engine is gated on spec ratification + ADR.
- **Backing infrastructure exists.** `@daedalus/core` (use cases + events), `JsonlEventStoreAdapter`, lineage helpers (`startLineage`, `followFrom`) — all in place (Spec 006, ADR-004). The engine consumes them; it adds nothing new to Core.
- **The first workflow is already observable.** Tenant 0's 19-event seed walks the chain; the engine v0.1.0 turns those events into a workflow instance under `lead-to-payment`.
- **Blockers:** Spec 008 ratification + ADR.

---

## 2. v0 build (Phase 2) — NOT STARTED

Each task maps to a Spec 008 AC and a Plan 008 build step.

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-01 | `packages/workflow-engine/` scaffolding: directory, `package.json` with **no** `dependencies`, `README.md` | AC-10 | ⏸ |
| T-02 | `domain/workflow.ts` — Workflow artifact type (read-only) | AC-1 | ⏸ |
| T-03 | `domain/instance.ts` — Instance state (read-only); bound to `(workflowName, version)` | AC-6 | ⏸ |
| T-04 | `domain/guard.ts` — pure guard evaluator (event + instance → bool) | AC-1 | ⏸ |
| T-05 | `application/ports/policy.ts` — `PolicyDecisionPort` interface (no-op implementation in v0) | AC-9 | ⏸ |
| T-06 | `application/deps.ts` — `EngineDeps`: `EventStorePort` + `PolicyDecisionPort` + clock + id + use-case registry | AC-3 | ⏸ |
| T-07 | `application/use-cases.ts` — `resolveUseCase(name)` → invocable use case. Registry of names from Core + Spec 001 v0/v1 (no modules beyond what already exists). | AC-3, R2 | ⏸ |
| T-08 | `application/transitions.ts` — `evaluateTransitions(workflow, instance, event)` → matched transitions | AC-1 | ⏸ |
| T-09 | `application/engine.ts` — the loop: load workflows, subscribe to stream, dispatch | AC-1, AC-2 | ⏸ |
| T-10 | `application/compensation.ts` — walk back active transitions; emit `…Cancelled` events | AC-5 | ⏸ |
| T-11 | `adapters/jsonl-workflow-store.ts` — read `blueprints/workflows/*.json` and `config/tenants/<t>/workflows.json` | AC-7 | ⏸ |
| T-12 | `adapters/jsonl-instance-store.ts` — write `.data/tenants/<t>/workflow-instances.jsonl`; recover cursor on boot | AC-2 | ⏸ |
| T-13 | `cli.ts` — entry point: `node packages/workflow-engine/src/cli.ts run --tenant tenant-0 --poll-ms 200` | — | ⏸ |
| T-14 | `blueprints/workflows/lead-to-payment.v0.1.0.json` — first workflow artifact (Conceptual shape in Plan 008 §3) | AC-1, AC-3, AC-4 | ⏸ |
| T-15 | `apps/cli/src/index.ts` — add `human:approve` and `human:reject` commands (emit `HumanApproved` / `HumanRejected`) | AC-4 | ⏸ |
| T-16 | `config/tenants/tenant-0/workflows.json` — empty override file (Tenant 0 inherits defaults); comment why | AC-7 | ⏸ |
| T-17 | `tests/engine-declarative.test.ts` — AC-1 | AC-1 | ⏸ |
| T-18 | `tests/engine-idempotency.test.ts` — AC-2 (re-process same event → no duplicate transition) | AC-2 | ⏸ |
| T-19 | `tests/engine-actions.test.ts` — AC-3 (action invocation + lineage capture) | AC-3 | ⏸ |
| T-20 | `tests/engine-human-gate.test.ts` — AC-4 (matched transition waits; `HumanApproved` fires it) | AC-4 | ⏸ |
| T-21 | `tests/engine-compensation.test.ts` — AC-5 (single-step failure → cancellation event + `WorkflowInstanceCompensated`) | AC-5 | ⏸ |
| T-22 | `tests/engine-versioning.test.ts` — AC-6 (v0.2.0 deploys; in-flight v0.1.0 instances continue under v0.1.0; new instances start under v0.2.0) | AC-6 | ⏸ |
| T-23 | `tests/engine-multi-tenant.test.ts` — AC-7 (two tenants, each sees only its bound version) | AC-7 | ⏸ |
| T-24 | `tests/engine-audit.test.ts` — AC-8 (every engine event has full lineage; replay reconstructs instance history) | AC-8 | ⏸ |
| T-25 | `tests/engine-policy-seam.test.ts` — AC-9 (no-op policy returns `allow`; seam is called; a deny returns `HumanApprovalRequired`) | AC-9 | ⏸ |
| T-26 | `tests/engine-zero-core-change.test.ts` — AC-10 (greps `packages/core/src` for forbidden new exports / new events) | AC-10 | ⏸ |
| T-27 | Evidence run: end-to-end `lead-to-payment` walk with Tenant 0 seed + `human:approve` for `paid → closed` | AC-1, AC-3, AC-4 | ⏸ |

---

## 3. Phase 3 — BLOCKED (Policy engine integration)

| ID | Task | Blocked by | Status |
|---|---|---|---|
| T-28 | Replace no-op `PolicyDecisionPort` with the real policy engine | Phase 3 not started | ⛔ |

---

## 4. Phase 5 — BLOCKED (second tenant + auth + agents)

| ID | Task | Blocked by | Status |
|---|---|---|---|
| T-29 | ATLAS Phase 2 panels (`active-processes`, `queue-status`, `workflow-metrics`) | Engine not yet shipped | ⛔ |
| T-30 | Workflow versioning migration helpers | Engine not yet shipped | ⛔ |

---

## 5. Out of scope (binding — from Spec 008 §11, §14)

- No sagas, no distributed coordination.
- No external scheduler / cron.
- No visual designer.
- No policy engine implementation (seam only in v0).
- No agent runtime.
- No new Core events / aggregates / projections.

---

## 6. Module impact (forward-compatibility note)

- **Core**: zero changes (Spec 008 AC-10). The engine consumes existing use cases.
- **Revenue Visibility, Proposal Generation, Opportunity Discovery**: zero changes in v0. The engine's use-case registry in v0.1.0 only includes Core use cases (e.g. `createProjectUseCase` from Spec 006). v0.2.0 of `lead-to-payment` may add module-specific actions (e.g. `confirmRevenueUseCase`), which requires module-side opt-in and a future spec.
- **ATLAS**: zero changes in this PR. The engine events show up in ATLAS's existing `/events` and `/activity` panels. Phase 2 panels ship with a separate spec.
- **CLI**: + 2 commands (`human:approve`, `human:reject`). No other commands change.

---

## 7. Activation criteria

T-01…T-27 may begin only when **all** of the following are true:

1. **Spec 008 is ratified** by stewards. ✅ (v0.2.0, 2026-06-21)
2. **An ADR moves the Workflow Engine** into the [Roadmap](../../docs/roadmap.md) Phase 2 slot. ✅ ([ADR-006](../../governance/decisions/ADR-006-adopt-workflow-engine.md) Accepted, 2026-06-21; Roadmap §Phase 2 already references the engine.)
3. **The founder (Tenant 0)** confirms the `lead-to-payment` v0.1.0 shape matches their operator needs (or approves the deviation). ✅ (steward confirmation recorded in branch `023-workflow-engine-ratify-pack`.)

**All activation criteria satisfied. T-01…T-27 authorized to build.**

---

*Subordinate to [Spec 008](./spec.md) and [Plan 008](./plan.md). Planning only — not a build authorization.*