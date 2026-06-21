# Spec 008 — Workflow Engine (Phase 2)

**Status:** Ratified · Phase 2 (build authorized)
**Type:** Core capability — declarative orchestration of value-chain transitions
**Owner:** Stewards
**Version:** 0.2.0
**Last updated:** 2026-06-21

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* the Workflow Engine is and *why*, not *how*. Conceptual domain language only — no JSON schemas, no code, no library choices.

> **Context.** Daedalus's value chain `Lead → Payment` is closed in Core (Spec 006). Three modules consume it (Spec 001–003). Today, every transition is **driven manually** through the CLI; the chain runs, but a human shepherds each step. The Workflow Engine makes those transitions **declarative**: the system reacts to events and advances state on its own, the way a policy-governed process should. It is the canonical Phase 2 capability on the [Roadmap](../../docs/roadmap.md). Until this spec is ratified and built, every "orchestrated" form in other specs (Spec 002 §13 orchestrated flow, Spec 003 §11 boundary resolution, ATLAS Phase 2 panels) is **forward-planning only**.

---

## 1. Summary

The Workflow Engine is a **declarative process layer** that subscribes to the Daedalus event stream and **automates transitions** between value-chain states. A workflow is a versioned artifact (a named, directed graph of states and transitions). The engine evaluates each new event against the active workflow instances and, when a transition matches, **invokes a use case** that emits the resulting events. State advances without a human at the keyboard — *but humans still approve at every gate the workflow marks as human-governed* (Constitution Article V).

Three durable guarantees:

- **Workflows are versioned artifacts.** A workflow is data, not code. The engine reads its definitions at boot. New versions start new instances; old instances drain under their original version. Migration is a documented process.
- **The engine emits, never mutates.** Actions are use cases that emit events through the existing `EventStorePort`. The engine has no write path that bypasses the event stream. Idempotency is enforced by the same lineage discipline (ADR-004) used everywhere else.
- **Compensation is built in.** Every transition can declare a compensating action. If a later step fails, the engine walks back the transitions and emits `…Cancelled` events already in the [Event Catalog](../../docs/event-catalog.md). Unhappy paths are first-class.

> **What this is NOT.** Not a saga framework (no distributed coordination in Phase 2). Not a BPMN engine (no graphical process designer). Not a workflow-as-a-service (no external scheduler; the engine runs in-process with the rest of Daedalus). Not an event bus (no pub/sub between processes). Not a policy engine (Phase 3; the engine has a policy seam but no policy logic in v0).

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Everything is an Event* (the engine's only output is events on the stream); *Auditability by Default* (every transition leaves a trail with lineage); *Policy before Agent* (the engine has a policy seam — v0 is a no-op, but the seam exists so Phase 3 can plug in); *Simplicity First* (one process, one in-process loop; no microservices, no queues). |
| **[Technical Principles](../../memory/technical-principles.md)** | Respects hexagonal layering: workflows live as **artifacts** consumed by an engine adapter; the engine is itself a **driving-side** concern (it triggers use cases) and not part of the Core domain. Resolves two items from the **"Avoid for now"** list: **"Sagas"** and **"Workflow Engine"**. Both are conditionally retired by this spec, because the conditions (events as source of truth, projection surfaces stable) are now met. |
| **[ADR-002](./ADR-002-adopt-technical-framework.md)** | The engine follows the framework: Spec → Plan → Tasks → Implementation. No functionality outside this spec. |
| **[ADR-004](./ADR-004-export-discipline-and-lineage.md)** | The engine inherits the lineage discipline. Every event it emits carries `correlationId` (the workflow instance's correlation) and `causationId` (the event that triggered the transition). Helpers `startLineage` and `followFrom` apply unchanged. |
| **[Roadmap](../../docs/roadmap.md)** | Implements Phase 2 — *Workflow Engine*. Phase 1 (Core) is shipped (Spec 006). Phase 3+ are downstream. |
| **[Event Catalog](../../docs/event-catalog.md)** | The engine emits existing events (`ProposalApproved`, `ProjectCreated`, `InvoicePaid`, etc.). It does **not** introduce new event types in v0; cancellation/compensation uses the deferred `…Cancelled` / `…Reopened` events already reserved in the catalog. |
| **Spec 001–003** | The engine **uses** the use cases these modules expose (e.g. `createProjectUseCase`, `confirmRevenueUseCase`). It does **not** modify those modules. |
| **Spec 006** | The Core value-chain aggregates and reactors (`createProjectUseCase`, `issueInvoiceUseCase`, `payInvoiceUseCase`) become **workflow actions**, not just CLI-invoked use cases. Their idempotency discipline (already in Core) is the engine's safety net. |
| **Spec 007 (ATLAS)** | The ATLAS Phase 2 panels (`active-processes`, `queue-status`, `workflow-metrics`) are **read-only views** over the engine's projections. They become viable when this engine ships. |

---

## 3. Goals

1. **Make the value chain run declaratively.** A workflow artifact describes `Lead → Payment`. The engine reads it and advances state on each event, without a human at each step.
2. **Make workflows versioned.** A change to the workflow is a new version with a clear migration story. Old instances finish under their original version; new instances use the new version.
3. **Make compensation first-class.** When a transition fails or a step is reversed, the engine emits the named cancellation event (e.g. `ProposalRejected` → unwind). No silent failures, no orphaned instances.
4. **Make human gates enforceable.** Workflows declare which transitions require human approval. The engine **does not bypass them** (Constitution Article V). Even with the engine running, irreversible or strategic gates stop and escalate.
5. **Make per-tenant overrides possible.** Tenant 0 (and any future tenant) can ship its own workflow definition. The engine merges default + tenant overrides.
6. **Make it observable.** The engine emits events for its own state transitions (workflow instance started, transition fired, compensation triggered) so ATLAS (and any future read-side adapter) can render Active Processes / Workflow Metrics without poking the engine's internals.
7. **Stay in-process.** One engine, one loop, one event store. No queues, no external schedulers, no microservices (Constitution Simplicity First).

---

## 4. Core / Module / Tenant split

| Layer | What lives there (this spec) |
|---|---|
| **Core** | No changes. The engine consumes existing use cases and emits existing events. |
| **New package** | `packages/workflow-engine/` — the engine. **Not** part of `@daedalus/core`; it is a **new driving-side concern** that orchestrates Core + modules. Lives as a peer to `@daedalus/revenue-visibility`. |
| **Workflow artifacts** | `blueprints/workflows/<name>.json` (default workflows). Versioned artifacts. |
| **Tenant config** | `config/tenants/<tenant>/workflows.json` (tenant-specific overrides). Tenant 0 inherits defaults. |
| **Tenant state** | `.data/tenants/<tenant>/workflow-instances.jsonl` (per-tenant instance log). Gitignored. |

> **Boundary discipline.** The engine imports `@daedalus/core` (use cases + types) and the module public contracts via package entry points (ADR-004). It does **not** import domain internals. It is a peer of the CLI; the CLI invokes use cases directly, the engine invokes the same use cases **in response to events**.

---

## 5. Domain concepts (conceptual — no schema)

- **Workflow.** A named, versioned, declarative description of a process. Has an `initial` state, a set of named states, and transitions keyed by event type.
- **Workflow version.** A semantic version (`major.minor.patch`). Major version changes may break compatibility; minor/patch are backward-compatible. The engine keeps instances bound to the version they were started under.
- **State.** A named node in the workflow's directed graph. Reaching a terminal state ends the instance.
- **Transition.** A rule: when in state `S` and event `E` arrives (with optional guards), advance to state `S'`, run a list of `actions`, and emit any resulting events.
- **Action.** An invocation of a use case (e.g. `createProjectUseCase`). The engine treats use cases as **black boxes** that emit events through the existing `EventStorePort`. The engine captures the resulting events and uses their lineage to continue.
- **Guard.** A predicate over event payload and instance state. Only transitions whose guard evaluates to true fire.
- **Compensation.** Each transition can declare a compensating action. If a later step fails or a step is reversed (e.g. an `InvoiceOverdue` arrives when the workflow expects `PaymentReceived`), the engine walks back the active transitions in reverse order, invoking compensations, and emits the corresponding `…Cancelled` events.
- **Workflow instance.** A single execution of a workflow, identified by a `correlationId`. Carries the bound `workflowName + version` and current state. Stored in the per-tenant instance log.
- **Human gate.** A transition marked `requiresHuman: true` does not auto-fire even if the trigger event arrives and the guard passes. The engine leaves the instance in its current state and emits a `HumanApprovalRequired` event naming the pending transition. A subsequent `HumanApproved` event (emitted by the CLI when a human acts) is what fires the transition.
- **Engine event.** The engine emits its own events for observability: `WorkflowInstanceStarted`, `WorkflowTransitionFired`, `WorkflowInstanceCompleted`, `WorkflowInstanceCompensated`, `HumanApprovalRequired`, `HumanApproved`. These are **engine events** — they live alongside value-chain events in the same stream. They follow the lineage discipline (ADR-004).

---

## 6. Events

The engine **consumes** value-chain events from the catalog (no new types in v0 for the consumed side). The engine **emits** a small set of engine events for observability and human-gate coordination:

| Engine event | When emitted | Lineage |
|---|---|---|
| `WorkflowInstanceStarted` | A new workflow instance is created (on the trigger event that matches the workflow's initial transition). | `correlationId` = new instance id; `causationId` = the trigger event. |
| `WorkflowTransitionFired` | A transition fires. Carries `workflowName`, `version`, `fromState`, `toState`, `actionUseCases`, `correlationId` of the value-chain event(s) emitted by actions. | `causationId` = the triggering event; `correlationId` = the workflow instance. |
| `HumanApprovalRequired` | A transition with `requiresHuman: true` is matched but waiting. | `causationId` = the matched event; `correlationId` = the workflow instance. |
| `HumanApproved` | A human approves via the CLI. The next matched event fires the pending transition. | `causationId` = the human's CLI action; `correlationId` = the workflow instance. |
| `WorkflowInstanceCompleted` | The instance reaches a terminal state. | `correlationId` = the workflow instance. |
| `WorkflowInstanceCompensated` | Compensation ran. Carries the compensated transition and the cancellation event(s) emitted. | `correlationId` = the workflow instance. |

The engine does **not** introduce new value-chain events. Cancellation uses the deferred `…Cancelled` events already reserved in the catalog (e.g. `LeadDiscarded`, `ProposalRejected`, `InvoiceOverdue`) — when a spec adds them, they plug into the compensation model unchanged.

---

## 7. Engine loop (binding)

1. **Boot.** The engine loads default workflows from `blueprints/workflows/` and tenant overrides from `config/tenants/<tenant>/`. For each registered workflow, the engine knows its current version set (one or more versions, in case of in-flight migrations).
2. **Stream subscription.** The engine subscribes to the per-tenant event stream. v0 uses **polling** (read the stream, compare against the last-seen `occurredAt`); Phase 5+ may add SSE. No event bus, no pub/sub.
3. **Event dispatch.** For each new event:
   - For each active workflow instance, evaluate the current state + event against the workflow's transitions.
   - For each transition whose trigger matches and whose guard passes:
     - If `requiresHuman: true`, emit `HumanApprovalRequired` and stop.
     - Else, run the transition: invoke the actions (use cases), capture resulting events, emit `WorkflowTransitionFired`, advance state.
   - If no transition matches, the event is ignored by this workflow (other workflows may still react).
4. **Compensation.** If an action throws, the engine walks back the active transitions of this instance in reverse order, invoking each transition's `compensate` action, and emits the resulting `…Cancelled` events plus `WorkflowInstanceCompensated`. The instance reaches a **compensation terminal** state.
5. **Idempotency.** Each transition has an `id` (the workflow name + version + transition name). The engine records fired transition ids in the instance log. A trigger event that would re-fire an already-fired transition is a no-op.
6. **Versioning.** A workflow instance is bound to `(workflowName, version)` at start. The engine never re-binds an existing instance to a newer version. New instances use the latest version.
7. **Human gate enforcement.** The engine never fires a `requiresHuman: true` transition without a `HumanApproved` event in the same correlation lineage. This is the canonical application of Constitution Article V (human accountability) and Principle 2 (policy before agent — humans in the loop for irreversible/strategic decisions).
8. **Policy seam.** Every action runs through a `PolicyDecisionPort` call. In v0 the port is a no-op (returns `allow`). Phase 3 plugs in the policy engine. The seam exists from day one so Phase 2 doesn't paint itself into a corner.

> **Failure modes.** The engine fails closed. If a transition's guard is ambiguous, the engine **does not** fire it and emits `HumanApprovalRequired` with the ambiguity noted. If a workflow definition is malformed, the engine refuses to boot. If an action throws an unrecoverable error, the engine compensates (see §7.4).

---

## 8. State machine — the engine's own (binding)

The engine itself is a small state machine:

```
              ┌──────────────────────┐
              │  READY (no events)   │
              └──────────┬───────────┘
                         │ new event
                         ▼
              ┌──────────────────────┐
              │  EVALUATING          │── no match ──> back to READY
              └──────────┬───────────┘
                         │ match
                         ▼
              ┌──────────────────────┐
              │  DECIDING            │
              │  (human gate? guard?)│
              └──┬───────────────┬───┘
                 │               │
       requiresHuman            no gate
                 │               │
                 ▼               ▼
        ┌─────────────┐  ┌──────────────┐
        │ WAITING_HUMAN│  │ FIRING       │
        └──────┬──────┘  └──────┬───────┘
               │ approval        │ done
               ▼                 ▼
        ┌─────────────┐  ┌──────────────┐
        │ FIRING       │  │ RECORDING    │── terminal (or compensating)
        └─────────────┘  └──────────────┘
```

Terminal outcomes: `COMPLETED` (instance reached a terminal state) or `COMPENSATED` (a failure ran the compensation chain). The instance log records the outcome and a SHA-256 of the instance state.

---

## 9. Workflow artifact (conceptual shape)

A workflow artifact is a versioned JSON document. The conceptual shape (no schema, no code):

```
Workflow {
  name:        string          // e.g. "lead-to-payment"
  version:     "x.y.z"         // semantic version
  initial:     stateRef        // the state new instances start in
  terminal:    [stateRef]      // states that end the instance
  states:      { name → State }
  contexts:    { correlationKey: eventType? }  // how to find existing instances
}

State {
  on: { eventType → [Transition] }   // event triggers and their transitions
}

Transition {
  id:           string          // unique within workflow+version
  target:       stateRef        // state after the transition fires
  guard?:       expression      // optional; evaluated over event + instance
  requiresHuman?: boolean       // if true, do not auto-fire
  actions?:     [ActionRef]     // use cases to invoke, in order
  compensate?:  ActionRef       // use case to invoke on rollback
  emitAfter?:   [eventType]     // engine waits for these events before advancing
}

ActionRef {
  useCase:      string          // e.g. "createProjectUseCase"
  args:         { field: expr } // how to map event/instance to use-case args
}
```

> **No external DSL.** The engine reads JSON. Workflow authors edit JSON. No YAML (would add a parser dep; Simplicity First). No visual designer (out of scope; the artifact is the contract).

---

## 10. Acceptance criteria

**AC-1 (Declarative advancement).**
- *Given* a workflow `lead-to-payment` v0.1.0 with a transition `LeadQualified → qualified`,
- *When* a `LeadQualified` event arrives for a tenant whose stream has no existing instance,
- *Then* the engine creates an instance, emits `WorkflowInstanceStarted`, and advances to `qualified`.

**AC-2 (Idempotency).**
- *Given* an instance already in state `qualified`,
- *When* the same `LeadQualified` event is re-processed (e.g. on engine restart),
- *Then* the engine emits no new events; the instance remains in `qualified`.

**AC-3 (Action invocation).**
- *Given* a transition `ProposalApproved → approved` with action `createProjectUseCase`,
- *When* a `ProposalApproved` event arrives,
- *Then* the engine invokes `createProjectUseCase` (using args derived from the event + instance), captures the resulting `ProjectCreated` event, and emits `WorkflowTransitionFired` with the project creation in the lineage.

**AC-4 (Human gate).**
- *Given* a transition marked `requiresHuman: true`,
- *When* its trigger event arrives and the guard passes,
- *Then* the engine emits `HumanApprovalRequired` and does **not** invoke the action.
- *And* when a `HumanApproved` event arrives for the same correlation,
- *Then* the engine invokes the action and emits `WorkflowTransitionFired`.

**AC-5 (Compensation).**
- *Given* an instance in `approved` with a previous transition `ProjectCreated → created`,
- *When* an action throws,
- *Then* the engine invokes the compensating action of the prior transition, emits the corresponding cancellation event (e.g. `ProjectClosed`), and emits `WorkflowInstanceCompensated`.

**AC-6 (Versioning).**
- *Given* workflow v0.1.0 has 3 in-flight instances and v0.2.0 is deployed,
- *When* a new trigger event arrives,
- *Then* the engine starts the new instance under v0.2.0 while the existing 3 continue under v0.1.0.

**AC-7 (Multi-tenant).**
- *Given* Tenant 0 has its own override of `lead-to-payment` v0.3.0 and Tenant 1 uses the default v0.1.0,
- *When* the engine boots for each tenant,
- *Then* each tenant sees only its bound version(s); no cross-tenant state.

**AC-8 (Auditability).**
- *Given* any engine-emitted event,
- *Then* it carries tenant, actor, correlationId, causationId, and payload; the event log is replayable to reconstruct every instance's history.

**AC-9 (Policy seam).**
- *Given* an action that the `PolicyDecisionPort` denies,
- *When* the engine attempts to invoke it,
- *Then* the engine does **not** invoke the action; it emits `HumanApprovalRequired` with the denial reason.
- *And* the seam is exercised even in v0 (the no-op policy returns `allow` for non-flagged actions).

**AC-10 (Zero new Core primitives).**
- *Given* the engine is built,
- *Then* `@daedalus/core` is unchanged (no new events, aggregates, projections, ports).
- *And* the engine consumes only existing use cases from Core and from the public contracts of modules.

---

## 11. Non-goals (binding)

- **No full CQRS.** The engine operates on the same event store; no separate write/read models. (Per Technical Principles "Avoid for now" — retired *for this spec only*.)
- **No sagas.** No distributed coordination across services. The engine runs in-process. (Same retirement.)
- **No external scheduler / cron.** All triggers are events; no time-based activations in v0. Scheduled transitions are a future concern (ATLAS Phase 2 panels may surface them; a Phase 5 scheduler is a separate spec).
- **No workflow versioning migration tools.** Old instances drain under their original version. A migration helper is a future spec (it does not belong here).
- **No visual designer.** The workflow artifact is JSON. A designer is a future concern.
- **No multi-process / distributed engine.** One engine, one process. Horizontal scale is not in scope.
- **No policy engine in v0.** The policy seam is wired; the implementation is a Phase 3 spec.
- **No agent runtime in v0.** The engine reacts to events and invokes use cases. It does not invoke agents.
- **No new Core events, aggregates, or projections in v0.** Cancellation uses the existing `…Cancelled` / `…Rejected` / `…Overdue` events already in the catalog.

---

## 12. Risks

- **R1 — Premature complexity.** The workflow engine is a substantial capability. *Mitigation:* AC-10 — zero new Core primitives; the engine is a peer to the CLI that consumes existing use cases. The first workflow shipped is the simplest one (`lead-to-payment` v0.1.0); complexity follows usage.
- **R2 — Hidden coupling.** A workflow that hard-codes a use case from a specific module creates coupling. *Mitigation:* Workflows reference use cases by name (string); the engine resolves them at boot. Mismatches fail closed at boot, not silently mid-flight.
- **R3 — Idempotency drift.** A re-fired transition that wasn't idempotent would emit duplicate events. *Mitigation:* AC-2 + the existing Core use-case idempotency discipline (each reactor is idempotent on its trigger key). The engine's instance log records fired transitions to prevent re-fire.
- **R4 — Compensation correctness.** Unwinding a multi-step transition is harder than advancing it. *Mitigation:* Compensation is **explicit** in the artifact (each transition declares its `compensate` action); there is no automatic inference. AC-5 covers a single-step compensation in v0; multi-step compensation chains are validated in tests.
- **R5 — Human-gate circumvention.** A workflow that forgets `requiresHuman: true` on an irreversible step would auto-fire it. *Mitigation:* AC-4 + the token-linter pattern (Phase 3 will enforce human-required flags for transitions that emit irreversible events). v0 ships with explicit author discipline.
- **R6 — Policy seam left unused.** Without Phase 3, the seam is a no-op. *Mitigation:* AC-9 exercises the seam in v0 (the no-op policy returns `allow`); a test verifies the seam is called. The path to Phase 3 is mechanical.
- **R7 — Version drift.** Workflow authors edit the default; instances in flight bind to old versions. *Mitigation:* AC-6; old instances drain. The engine refuses to delete a version that has in-flight instances unless a flag is set.

---

## 13. Open questions

- **Q1 — Workflow definition format.** JSON (zero deps, native) vs YAML (more readable, needs a parser dep). *Recommendation:* JSON. Spec 007 ATLAS already encodes this principle.
- **Q2 — Package vs Core extension.** A new `packages/workflow-engine/` vs an extension of `@daedalus/core`. *Recommendation:* new package. The engine is a *driving-side* concern (it triggers use cases); the Core stays pure domain + application.
- **Q3 — Discovery model.** How the engine finds existing instances for an incoming event. *Recommendation:* by `correlationId` of the event (the engine reads the lineage header); if no instance exists and the event matches a workflow's initial trigger, a new instance starts. Simple, replayable.
- **Q4 — Compensation events.** Auto-generated by the engine (`…Cancelled`) or explicit (each transition names its own cancellation event)? *Recommendation:* explicit. The catalog already names `LeadDiscarded`, `ProposalRejected`, `InvoiceOverdue`; the engine emits those, not new types.
- **Q5 — Multi-tenant workflow overrides.** Single workflow per type with tenant config, or fully separate workflow sets per tenant? *Recommendation:* per-type with tenant config overrides. Tenant 0 inherits the default `lead-to-payment`; a future tenant with a different process can override specific transitions.
- **Q6 — Engine polling vs push.** Polling the event stream (simple, replayable) vs an SSE-style push (efficient for high throughput). *Recommendation:* polling in v0. Same line as the rest of Daedalus — replayable is the primitive; performance is a follow-up.
- **Q7 — Time-based transitions.** "If no event arrives within X days, fire this transition." *Recommendation:* out of scope for v0. The engine has no scheduler. This is a future spec that may share the engine's transition model.

---

## 14. Out of scope (binding)

- Implementation is authorized **only** by an ADR ratifying this spec AND the resulting `plan.md`.
- This spec does **not** authorize a policy engine, an agent runtime, a scheduler, a visual designer, or a workflow migration tool.
- This spec does **not** add new value-chain events. Cancellation uses events already reserved in the [Event Catalog](../../docs/event-catalog.md).
- This spec does **not** modify any module other than adding **use cases** to the engine's invocation table (no module is changed unless its maintainers approve).
- Future enhancements (deferred): multi-engine coordination, distributed sagas, scheduled transitions, workflow migration tools, visual designer, policy engine integration (Phase 3).

---

## 15. Companion artifacts

- **`plan.md`** — implementation plan: package layout (`packages/workflow-engine/`), workflow artifacts (`blueprints/workflows/`), per-tenant config, engine loop pseudocode, definition of done.
- **`tasks.md`** — task breakdown (T-01…T-N), forward-planning, not a build authorization.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and the [Roadmap](../../docs/roadmap.md). One process, one event stream, no microservices. The first workflow shipped is the simplest useful one; complexity follows usage.*