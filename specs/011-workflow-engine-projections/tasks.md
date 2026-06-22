# Tasks — Spec 011 implementation (Workflow Engine Projections)

**Status:** Implementation tasks for [Spec 011 v1.0](./spec.md) + [Plan 011 v1.0](./plan.md)
**Derives from:** Spec 011 acceptance criteria + Plan 011 file-by-file sequence
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008](../008-workflow-engine/spec.md).
**Version:** 1.1.0
**Last updated:** 2026-06-22

> Tasks map 1:1 to Spec 011 acceptance criteria + Plan 011 implementation phases. T-01..T-04 are types (no behavior, easy review). T-05 is the port extension (interface only). T-06..T-08 are the three pure projection functions. T-09 is the adapter. T-10 is the barrel. T-11..T-13 are tests. T-14 is the engine regression check.

---

## 1. Reality check

- **Spec status:** Ratified (PR #53 merged 2026-06-22).
- **Engine loop:** shipped (Spec 008, PR #40). `runEngine` writes `Instance` objects via `InstanceStorePort.save` — unchanged in this PR.
- **Adapter:** `JsonlInstanceStoreAdapter` exists; implements `findByCorrelationId`, `save`, `getCursor`, `setCursor`. **Will gain a fifth method:** `list`.
- **Barrel:** `packages/workflow-engine/src/index.ts` exports curated named types + a few functions; no `export *`. Will gain 5 new named exports.
- **Test layout:** top-level `tests/*.test.ts`; workflow-engine tests live alongside the engine behavior tests (`engine-*.test.ts`). New test files: `workflow-engine-projections.test.ts` + `workflow-engine-instance-list.test.ts`.

---

## 2. Implementation tasks

### Phase A — Types

- [ ] T-01: `domain/instance-query.ts` — `InstanceStatusFilter` union + `InstanceQueryOptions` interface (with JSDoc on defaults + clamps) (Spec §3.1) (pending)
- [ ] T-02: `domain/projection-types.ts` — `ActiveProcessView`, `QueueStatus` (with `byWorkflow[]` + `totals`), `WorkflowMetrics` (with `byWorkflow[]` + `totals`) (Spec §3.2–§3.4) (pending)

### Phase B — Port extension (interface only)

- [ ] T-03: `application/ports/instance-store.ts` — add `list(tenantId, options?): Promise<Instance[]>` to the interface; existing methods untouched (Spec §4.1) (pending)

### Phase C — Pure projection functions

- [ ] T-04: `application/projections/_helpers.ts` — internal helpers (not re-exported): `filterByStatus`, `filterSince`, `sortByStartedAtDesc`, `clampLimit` (Plan §2.4) (pending)
- [ ] T-05: `application/projections/active-processes.ts` — `projectActiveProcesses(instances, now)`; filters to live statuses, sorts by age desc, builds 8-field rows (Spec §4.2 + AC-5) (pending)
- [ ] T-06: `application/projections/queue-status.ts` — `projectQueueStatus(instances, now)`; per-workflow counts + 24h totals, ordered by waitingHumanCount desc → activeCount desc (Spec §4.2 + AC-6) (pending)
- [ ] T-07: `application/projections/workflow-metrics.ts` — `projectWorkflowMetrics(instances, since, now)`; window filter, counts, avg `history[-1].firedAt - startedAt` (null on empty), per-workflow + totals (Spec §4.2 + AC-7) (pending)

### Phase D — Adapter

- [ ] T-08: `adapters/jsonl-instance-store.ts` — implement `list` (stream per-tenant file, filter in memory, sort desc, clamp limit to 1000; `[]` on missing file) (Spec §4.1 + AC-1, AC-4) (pending)

### Phase E — Barrel (ADR-004)

- [ ] T-09: `src/index.ts` — curated named exports for the 5 new symbols (`InstanceStatusFilter`, `InstanceQueryOptions`, `ActiveProcessView`, `QueueStatus`, `WorkflowMetrics`, `projectActiveProcesses`, `projectQueueStatus`, `projectWorkflowMetrics`); no `export *` (Spec §4.3 + AC-9) (pending)

### Phase F — Tests

- [ ] T-10: `tests/workflow-engine-projections.test.ts` — AC-5, AC-6, AC-7, AC-8 (projection shape + ordering + pureness; in-memory `Instance[]`, no I/O) (AC-5, AC-6, AC-7, AC-8) (pending)
- [ ] T-11: `tests/workflow-engine-instance-list.test.ts` — AC-1 (tenant isolation across two seeded tenants), AC-4 (limit clamp 1500 → 1000), AC-9 (no `export *` in barrel, imports resolve) (AC-1, AC-4, AC-9) (pending)
- [ ] T-12: `tests/workflow-engine-instance-list.test.ts` — AC-2 (`status` filter), AC-3 (`workflowName` filter) (AC-2, AC-3) (pending)

### Phase G — Regression

- [ ] T-13: Run `npm test` — confirm existing 153 tests still pass (no engine loop regression, AC-10) (AC-10) (pending)
- [ ] T-14: Run `npm test` — confirm projection tests + instance-list tests pass (ACs 1–9) (AC-1..AC-9) (pending)

---

## 3. Activation criteria (all met by the time this PR opens)

- ✅ Spec 011 ratified (PR #53 merged).
- ✅ Plan 011 + Tasks 011 land in this same PR.
- ⏸ Implementation lands in this PR.
- ⏸ Tests pass.
- ⏸ PR review + merge.

## 4. Definition of done

- T-01..T-14 all ✅.
- `npm test` exits 0 with **all** existing 153 tests + new projection/list tests passing.
- `grep -rE '^export \*' packages/workflow-engine/src/index.ts` returns nothing.
- The barrel exports list matches §4.3 of the spec (curated named exports, no `export *`).
- The PR description states "AC results" (which ACs covered, test counts) — same async-handoff pattern as Spec 008/009/010 implementation PRs.

## 5. Out of scope (binding — from Spec 011 §8)

- ATLAS panel wiring (T-20..T-22 in [Spec 007 tasks](../007-atlas-ui/tasks.md)) — separate PR, consumes these exports.
- Pre-existing `findByCorrelationId` return-type quirk — separate issue.
- Caching, CQRS read model, query DSL — all Spec 011 §8 deferred.

---

*Subordinate to [Spec 011](./spec.md) and [Plan 011](./plan.md). Strictly additive.*