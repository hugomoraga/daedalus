# Spec 011 — Workflow Engine Projections (read-side for ATLAS / observability)

**Status:** Ratified · **read-side surface** · build authorized (Phase 2 follow-on)
**Type:** Core capability extension — read-only projections over workflow engine state
**Owner:** Stewards
**Validation priority:** unblocks ATLAS Phase 2 panels (T-20..T-22 in [Spec 007 tasks](../007-atlas-ui/tasks.md))
**Version:** 1.0.0
**Last updated:** 2026-06-22

> **Method.** Spec-first (Constitution, Principle 8). Spec → Plan → Tasks → Implementation. This v1.0 ratifies the **read-side projection surface** the workflow engine exposes for observability consumers (ATLAS first; other future consumers are allowed but not designed for here). It does **not** modify the engine loop, the engine's write semantics, the event store, or any other package's public contract.

> **What this is.** A small, bounded read-side addition: a list/filter query on the existing `InstanceStorePort`, and three pure projection functions that turn instance state into display shapes ATLAS can render. Zero new event types. Zero writes through these functions. Zero changes to the engine's `runEngine` loop.

> **What this is NOT.** Not a general workflow query language. Not a CQRS read model with its own store. Not a new event type. Not a change to Spec 008's engine semantics. Not a refactor of `InstanceStorePort` — only an additive read method.

---

## 1. Why this spec exists (the gap it closes)

[Spec 008 — Workflow Engine](../008-workflow-engine/spec.md) shipped the engine that drives the value chain (PR #40). The engine owns `Instance` state via `InstanceStorePort` and emits a small set of engine events. Spec 008 §5 explicitly declares *"No new value-chain events in v0"*, which kept the engine scope honest.

What Spec 008 did **not** ship:

1. A **list/filter read** over `InstanceStorePort` — only `findByCorrelationId` (single-row lookup) exists today.
2. **Projection functions** that turn `Instance[]` into the shapes observability consumers (ATLAS first) need to render active processes, queue status, and metrics.

[Spec 007 — ATLAS](../007-atlas-ui/spec.md) §3 names three Phase 2 panels whose backing models do not yet exist:

| Spec 007 panel | Tasks.md ref | Backing model needed |
|---|---|---|
| Active Processes | T-20 | Active workflow instances (id, workflow, state, age, pending human gate) |
| Queue Status | T-21 | Per-workflow event counts + waiting-human totals |
| Workflow Metrics | T-22 | Completion rate, avg time-to-complete, compensated last 24h |

This spec **defines those backing models** and ships them as **read-only projections** over existing engine state. The engine loop and event store are unchanged.

## 2. Design constraints (binding)

- **Read-only.** No writes through any function defined here. The projections are pure (same input → same output; no side effects; no I/O).
- **Tenant-scoped structurally.** `listInstances` takes `tenantId` as a first parameter and the engine's `InstanceStorePort` enforces it (path-scoped JSONL, `assertSafeSegment` already in place). Projections consume the already-scoped result; they do not re-filter.
- **No new event types.** The projections read existing `Instance` state. They do not emit `WorkflowInstanceStarted`, etc.
- **No engine loop changes.** `runEngine` is untouched. The engine writes instances the same way it always did; this spec only adds reads.
- **No new package.** Lives inside `@daedalus/workflow-engine` next to the existing `application/` code. Follows the `revenue-visibility/src/application/projections/` pattern (post-PR #45).
- **Curated named exports.** Per ADR-004. No `export *`. Public additions go in the package barrel with explicit names.

## 3. Concepts

### 3.1 `InstanceQueryOptions` (filter shape)

```ts
export type InstanceStatusFilter = "active" | "waiting_human" | "completed" | "compensated";

export type InstanceQueryOptions = {
  status?: InstanceStatusFilter[];      // default: ["active", "waiting_human"]
  workflowName?: string;                // exact match
  workflowVersion?: string;             // exact match (rarely useful alone; pair with workflowName)
  limit?: number;                       // default: 100; max: 1000
  since?: string;                       // ISO date — only instances with startedAt >= since
};
```

`status` defaults to live instances (no historical completed/compensated). Callers wanting history pass them explicitly.

### 3.2 `ActiveProcessView` (projection result for T-20)

One row per live instance. The shape ATLAS renders:

```ts
export type ActiveProcessView = {
  correlationId: string;        // == Instance.id
  workflowName: string;
  workflowVersion: string;
  currentState: string;          // human-readable state name (e.g. "qualified", "approved", "waiting_payment")
  status: "active" | "waiting_human";
  ageMs: number;                 // now - startedAt
  pendingTransitionId: string | null;  // populated when status === "waiting_human"
  lastFiredAt: string | null;    // ISO; from history[-1]?.firedAt
};
```

### 3.3 `QueueStatus` (projection result for T-21)

```ts
export type QueueStatus = {
  byWorkflow: Array<{
    workflowName: string;
    activeCount: number;
    waitingHumanCount: number;
  }>;
  totals: {
    active: number;
    waitingHuman: number;
    completed24h: number;        // last 24h, computed over `now`
    compensated24h: number;      // last 24h, computed over `now`
  };
};
```

`byWorkflow` is sorted by `waitingHumanCount` desc, then `activeCount` desc — so the panel surfaces bottlenecks first.

### 3.4 `WorkflowMetrics` (projection result for T-22)

```ts
export type WorkflowMetrics = {
  windowMs: number;              // the `since` window length (informational)
  byWorkflow: Array<{
    workflowName: string;
    completedInWindow: number;
    compensatedInWindow: number;
    avgCompletionMs: number | null;  // null if no completions in window
  }>;
  totals: {
    completedInWindow: number;
    compensatedInWindow: number;
    avgCompletionMs: number | null;  // null if no completions in window
  };
};
```

`avgCompletionMs` is the average of `(history[-1].firedAt - startedAt)` over completed instances in window. Null when zero completions (avoid `0` ambiguity).

## 4. Engine API additions (additive — no removals)

### 4.1 `InstanceStorePort.list` (new method)

```ts
export interface InstanceStorePort {
  // ... existing methods unchanged ...
  findByCorrelationId(tenantId: string, correlationId: string): Promise<Instance | null>;
  save(tenantId: string, instance: Instance): Promise<void>;
  getCursor(tenantId: string): Promise<string | null>;
  setCursor(tenantId: string, occurredAt: string): Promise<void>;

  // NEW in v1.0
  list(
    tenantId: string,
    options?: InstanceQueryOptions,
  ): Promise<Instance[]>;
}
```

**Semantics.** Returns instances for the given `tenantId`, filtered and limited per `options`. Tenant isolation is structural (path-scoped storage; no cross-tenant reads possible). Default ordering is `startedAt` desc. The JSONL adapter implements `list` by streaming the per-tenant file and applying filters in memory (acceptable for the per-tenant file sizes Phase 2 ATLAS panels target; a future spec may introduce indexing if a tenant crosses the 10k-instance threshold).

**Errors.** `list` does not throw on empty results — returns `[]`. It throws on filesystem errors only (delegated from the adapter).

### 4.2 Three pure projection functions (new exports)

```ts
// All three are pure: same input + same `now`/`since` → same output. No I/O.

export function projectActiveProcesses(
  instances: Instance[],
  now: string,                      // ISO; passed in for determinism
): ActiveProcessView[];

export function projectQueueStatus(
  instances: Instance[],
  now: string,                      // ISO; passed in for determinism
): QueueStatus;

export function projectWorkflowMetrics(
  instances: Instance[],
  since: string,                    // ISO; window start
  now: string,                      // ISO; window end
): WorkflowMetrics;
```

All three consume `Instance[]` already filtered by `list(...)`. The caller is responsible for passing the right slice (e.g. only completed instances to `projectWorkflowMetrics` if it wants metrics over that slice).

### 4.3 Public barrel additions (ADR-004)

Added to `packages/workflow-engine/src/index.ts` under **explicit named exports** (no `export *`):

```ts
// NEW in v1.0
export type { InstanceStatusFilter, InstanceQueryOptions } from "./domain/instance-query.ts";
export type { ActiveProcessView, QueueStatus, WorkflowMetrics } from "./domain/projection-types.ts";

// NEW port method (extension of existing interface)
export type { InstanceStorePort }; // re-export unchanged (interface now has `list`)

// NEW pure functions
export { projectActiveProcesses } from "./application/projections/active-processes.ts";
export { projectQueueStatus } from "./application/projections/queue-status.ts";
export { projectWorkflowMetrics } from "./application/projections/workflow-metrics.ts";
```

The existing `InstanceStorePort` re-export is unchanged in name but the interface gains the `list` method. This is a **minor version bump** for `@daedalus/workflow-engine` consumers in spirit (interfaces are not runtime-versioned), documented here.

## 5. What the engine MUST do (binding)

1. **Expose `list(tenantId, options)`** on `InstanceStorePort`. The default JSONL adapter implements it; any custom adapter MUST implement it.
2. **Return only instances for the queried `tenantId`.** Path-scoped storage makes this structural; the adapter MUST NOT consult other tenants' files.
3. **Honor `options.status`, `options.workflowName`, `options.workflowVersion`, `options.since`** as filter predicates.
4. **Apply `options.limit`** as a hard cap. The default is 100; values above 1000 are clamped to 1000.
5. **Sort results by `startedAt` desc** by default (most recent first — the panel-friendly order).
6. **Expose the three projection functions** as pure, deterministic, side-effect-free exports.
7. **Keep the engine loop (`runEngine`) unchanged.** The new exports are read-side only; `runEngine` writes the same way it always did.

## 6. What the engine MUST NOT do

- **Write** through `list` or any projection. They are reads.
- **Mutate** the `Instance` objects returned. The adapter returns defensive copies or readonly views if mutation is a concern; consumers MUST treat them as read-only.
- **Emit events.** Projections are quiet. They do not appear in the event stream.
- **Cross tenant boundaries.** `list`'s `tenantId` parameter is the only source of truth for which instances are visible.
- **Change `runEngine`'s behavior.** The loop's write path, cursor semantics, and event emission are untouched.
- **Add new event types.** The projections are read-side views over existing `Instance` state.
- **Cache results across tenants.** Any internal cache is keyed by `tenantId`.

## 7. Acceptance criteria

**AC-1 (`list` tenant isolation).**
- *Given* two tenants each with 3 instances,
- *When* `list("tenant-A", {})` is called,
- *Then* the result contains only tenant-A's instances (zero cross-leakage).
- *And* a dedicated test seeds two tenants and asserts strict isolation.

**AC-2 (`list` filter — `status`).**
- *Given* 5 instances across all four statuses,
- *When* `list(tenantId, { status: ["waiting_human"] })` is called,
- *Then* only instances with `status === "waiting_human"` are returned.

**AC-3 (`list` filter — `workflowName`).**
- *Given* 3 instances of `lead-to-payment` and 2 of another workflow,
- *When* `list(tenantId, { workflowName: "lead-to-payment" })` is called,
- *Then* only the 3 matching instances are returned.

**AC-4 (`list` limit clamp).**
- *Given* 1500 instances,
- *When* `list(tenantId, { limit: 5000 })` is called,
- *Then* exactly 1000 are returned (clamped to the 1000 cap).

**AC-5 (`projectActiveProcesses` shape + ordering).**
- *Given* 4 instances (2 active, 2 waiting_human),
- *When* `projectActiveProcesses(instances, now)` is called,
- *Then* the result has 4 rows, each with `correlationId`, `workflowName`, `workflowVersion`, `currentState`, `status`, `ageMs`, `pendingTransitionId` (non-null when waiting_human), and `lastFiredAt`.
- *And* rows are ordered by `ageMs` desc (oldest first — what an operator wants to see at the top).

**AC-6 (`projectQueueStatus` aggregation).**
- *Given* instances across 2 workflows with mixed statuses,
- *When* `projectQueueStatus(instances, now)` is called,
- *Then* `byWorkflow` lists both workflows with correct counts, ordered by `waitingHumanCount` desc then `activeCount` desc.
- *And* `totals.active` and `totals.waitingHuman` are the sums across `byWorkflow`.

**AC-7 (`projectWorkflowMetrics` window).**
- *Given* 10 completed instances in the last 24h and 5 compensated,
- *When* `projectWorkflowMetrics(allInstances, since24hAgo, now)` is called,
- *Then* `totals.completedInWindow === 10`, `totals.compensatedInWindow === 5`, and `avgCompletionMs` is the mean of the 10 completions' durations (or `null` when zero).
- *And* `byWorkflow` reflects per-workflow breakdown.

**AC-8 (projection pureness).**
- *Given* the same input array and same `now`/`since`,
- *When* any of the three projection functions is called twice,
- *Then* the two results are deep-equal (no hidden state, no I/O, no Date.now() leakage).

**AC-9 (export discipline, ADR-004).**
- *Given* the package barrel `packages/workflow-engine/src/index.ts`,
- *When* `grep -E '^export \*' src/index.ts` runs,
- *Then* no match.
- *And* the new exports listed in §4.3 are present as explicit named exports.

**AC-10 (no engine loop regression).**
- *Given* the existing engine loop (`runEngine`),
- *When* `npm test` runs the workflow-engine suite,
- *Then* all pre-existing tests pass unchanged (no engine semantics drift).

## 8. Non-goals (binding for v1.0)

- **A general workflow query language.** Filters are limited to the four predicates in `InstanceQueryOptions`. Anything fancier (regex on workflow names, time-range on `lastFiredAt`, etc.) is future work.
- **A separate read store / CQRS read model.** Projections read from the same JSONL adapter the engine writes to. If a tenant crosses the perf threshold, a future spec introduces an indexed read store — that is not this spec.
- **Cross-tenant aggregation.** The projections are tenant-scoped. "All tenants in the system" is a future Spec (out of scope for v1; not an ATLAS need in Phase 2).
- **Push/streaming updates.** ATLAS still polls. SSE is a Spec 007 Phase 5 concern.
- **Caching across tenants.** Any caching layer (future spec) MUST key by `tenantId`. v1.0 does no caching.
- **A change to the engine loop.** Strictly additive.
- **A new event type.** Strictly additive.

## 9. Relation to canon

| Reference | Conformance |
|---|---|
| [Constitution Principle 3 — Everything is an Event](../memory/constitution.md) | Honored: projections read `Instance` state (a projection of events); they emit no events. |
| [Constitution Principle 4 — Auditability by Default](../memory/constitution.md) | Honored: `list` returns the same `Instance` objects the engine writes; lineage is preserved. |
| [Constitution Principle 9 — Simplicity First](../memory/constitution.md) | Honored: additive read surface, no new store, no new event type, no new package. |
| [Constitution Principle 10 — Generic Core, Specific Tenants](../memory/constitution.md) | Honored: projections are tenant-scoped structurally; tenant-specific content (thresholds, panel wiring) lives in ATLAS composition root and tenant profile. |
| [Technical Principles §2 — Hexagonal](../memory/technical-principles.md) | Honored: `InstanceStorePort.list` is a port method; the JSONL adapter implements it; the projection functions sit on the application layer. |
| [ADR-004 — Export discipline](../governance/decisions/ADR-004-export-discipline-and-lineage.md) | Honored: curated named exports; `export *` forbidden. |
| [Spec 008 — Workflow Engine](../008-workflow-engine/spec.md) | **Data source.** `Instance`, `InstanceStorePort`, `InstanceStatus` are all reused unchanged. |
| [Spec 007 — ATLAS](../007-atlas-ui/spec.md) | **First consumer.** T-20..T-22 activate when this spec lands. ATLAS composition root imports the projections from `@daedalus/workflow-engine`. |
| [Spec 007 — Companion note](../007-atlas-ui/spec.md) | ATLAS §14 now lists this spec as the unblocker for Phase 2 panels. |
| [Spec 008 — Roadmap Phase 2](../docs/roadmap.md#phase-2--workflow-engine) | This spec lands the read-side observability for the Phase 2 capability. |

## 10. Out of scope (binding)

- The **implementation plan** (`plan.md`) and **task breakdown** (`tasks.md`) — those land in the implementation PR, after this spec is approved. Spec-Driven Development: spec → plan → tasks → implementation.
- The actual ATLAS panel wiring (T-20..T-22 in [Spec 007 tasks](../007-atlas-ui/tasks.md)) — that is a follow-on PR that consumes this spec's exports.
- The Spec 007 `tasks.md` update that moves T-20..T-22 from ⛔ to ⏸ — that lands in this same ratification cycle (small markdown edit, included in the spec-merge PR).

---

*Subordinate to the [Constitution](../memory/constitution.md), [Technical Principles](../memory/technical-principles.md), [Spec 008](../008-workflow-engine/spec.md) (data source), and [Spec 007](../007-atlas-ui/spec.md) (first consumer). Strictly additive; no engine loop or event store changes.*
