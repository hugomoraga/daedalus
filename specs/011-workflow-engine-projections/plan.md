# Plan — Spec 011 implementation (Workflow Engine Projections)

**Status:** Implementation plan for [Spec 011 v1.0](./spec.md)
**Goal:** Add the additive read-side surface defined in Spec 011 §4–§6: one new port method, three pure projection functions, types, tests. No engine loop changes.
**Conforms to:** [Spec 011](./spec.md), [Spec 008](../008-workflow-engine/spec.md), [Technical Principles](../../memory/technical-principles.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md).
**Version:** 1.0.0
**Last updated:** 2026-06-22

> **Scope discipline.** This plan activates only after Spec 011 is ratified (PR #53 merged). The spec is the contract; this file is the file-by-file implementation sequence and the test layout.

---

## 1. File layout (additions only — no existing files restructured)

```
packages/workflow-engine/src/
  domain/
    instance-query.ts                    # NEW: InstanceStatusFilter, InstanceQueryOptions
    projection-types.ts                  # NEW: ActiveProcessView, QueueStatus, WorkflowMetrics
  application/
    ports/
      instance-store.ts                  # EDIT: add `list` method (additive)
    projections/                         # NEW directory (mirrors revenue-visibility/)
      _helpers.ts                        # NEW: shared filter/sort helpers (internal)
      active-processes.ts                # NEW: projectActiveProcesses
      queue-status.ts                    # NEW: projectQueueStatus
      workflow-metrics.ts                # NEW: projectWorkflowMetrics
  adapters/
    jsonl-instance-store.ts              # EDIT: implement `list` (stream + filter + limit)
  index.ts                               # EDIT: curated named exports per ADR-004

tests/
  workflow-engine-projections.test.ts    # NEW: AC-2,3,4,5,6,7,8 (projection functions)
  workflow-engine-instance-list.test.ts  # NEW: AC-1,9,10 (port + adapter + regression)
```

## 2. Implementation sequence

### Phase A — Types (no behavior, easy review)

1. **`domain/instance-query.ts`**: `InstanceStatusFilter` union type; `InstanceQueryOptions` interface (defaults documented as JSDoc).
2. **`domain/projection-types.ts`**: `ActiveProcessView`, `QueueStatus` (with `byWorkflow[]` and `totals`), `WorkflowMetrics` (with `byWorkflow[]` and `totals`).

### Phase B — Port extension (interface only)

3. **`application/ports/instance-store.ts`**: add `list(tenantId, options?): Promise<Instance[]>` to the interface. Existing methods unchanged. **The interface gains one method; that's a TypeScript additive change — no consumer breaks.**

### Phase C — Projection functions (pure, deterministic)

4. **`application/projections/_helpers.ts`**: internal helpers — `filterByStatus(instances, status)`, `filterSince(instances, since)`, `sortByStartedAtDesc(instances)`, `clampLimit(options)`. NOT re-exported from the package barrel.
5. **`application/projections/active-processes.ts`**: `projectActiveProcesses(instances, now)`. Builds one `ActiveProcessView` per instance, filters to live statuses (`active` + `waiting_human`), sorts by `ageMs` desc.
6. **`application/projections/queue-status.ts`**: `projectQueueStatus(instances, now)`. Groups by `workflowName`, counts by status, computes 24h totals over the `now` anchor, sorts `byWorkflow` by `waitingHumanCount` desc → `activeCount` desc.
7. **`application/projections/workflow-metrics.ts`**: `projectWorkflowMetrics(instances, since, now)`. Filters to completed/compensated within `[since, now]`, computes counts + avg `history[-1].firedAt - startedAt` per workflow and totals.

### Phase D — Adapter implementation

8. **`adapters/jsonl-instance-store.ts`**: implement `list(tenantId, options?)`. Streams the per-tenant file (same resilience as `findByCorrelationId`), filters in memory, sorts desc, clamps limit to 1000. Returns `[]` on missing file (no throw).

### Phase E — Barrel (ADR-004)

9. **`src/index.ts`**: add curated named exports:
   - `InstanceStatusFilter`, `InstanceQueryOptions` (types)
   - `ActiveProcessView`, `QueueStatus`, `WorkflowMetrics` (types)
   - `projectActiveProcesses`, `projectQueueStatus`, `projectWorkflowMetrics` (functions)
   - The `InstanceStorePort` re-export stays as-is (the interface itself gains `list`, but the export name doesn't change).
   - No `export *` introduced.

## 3. Test layout

### `tests/workflow-engine-projections.test.ts`

Unit tests with **no I/O** — instances constructed in-memory, no filesystem. Covers:

- **AC-2 / AC-3** — projection receives arbitrary `Instance[]`, returns the right shape regardless of input source.
- **AC-5** — `projectActiveProcesses`: shape (all 8 fields), ordering (age desc), `pendingTransitionId` null vs populated.
- **AC-6** — `projectQueueStatus`: per-workflow counts, totals match sum, ordering by waitingHumanCount desc → activeCount desc.
- **AC-7** — `projectWorkflowMetrics`: window filtering, `avgCompletionMs` computed over `history[-1].firedAt - startedAt`, `null` on empty window, per-workflow breakdown.
- **AC-8** — pureness: same input + same `now` → deep-equal output across two calls.

### `tests/workflow-engine-instance-list.test.ts`

Integration tests using a `tmpDir` (mirrors `tests/event-store.test.ts` pattern). Covers:

- **AC-1** — tenant isolation: seed two tenants, call `list` for one, assert zero leakage from the other.
- **AC-4** — limit clamp: seed 1500, request 5000, get 1000.
- **AC-9** — barrel discipline: import the new exports from `@daedalus/workflow-engine`; assert no `export *` in the barrel file.
- **AC-10** — engine loop regression: run a small scenario through `runEngine` (existing test file reused or a new minimal one); assert instances written are readable through `list` and have the expected shape.

## 4. Definition of done

- All 10 ACs from Spec 011 §7 covered by `node --test`.
- Existing 153 tests stay green (zero regression in Spec 008 semantics).
- The package barrel has no `export *` (AC-9 explicit check).
- `grep -rE 'export \*' packages/workflow-engine/src/index.ts` returns nothing.
- The JSONL adapter's existing pre-existing quirk (`findByCorrelationId` returns `Promise<Instance[]>` instead of `Promise<Instance | null>`) is **NOT** fixed in this PR — out of scope; flagged as a separate follow-up.
- No engine loop changes (the engine imports stay identical).
- New exports use curated named exports per ADR-004.

## 5. Out of scope (binding)

- ATLAS panel wiring (T-20..T-22 in [Spec 007 tasks](../007-atlas-ui/tasks.md)) — that is a separate PR that consumes these exports.
- The pre-existing `findByCorrelationId` return-type quirk — separate issue, separate PR.
- Caching layer across tenants — deferred per Spec 011 §8.
- CQRS read model with separate store — deferred per Spec 011 §8.
- A query DSL beyond the four predicates in `InstanceQueryOptions` — deferred per Spec 011 §8.

---

*Subordinate to [Spec 011](./spec.md) and [Spec 008](../008-workflow-engine/spec.md). Strictly additive; no engine semantics changes.*
