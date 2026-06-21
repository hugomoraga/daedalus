# Plan — Workflow Engine v0 (implementation when authorized)

**Status:** Draft · implementation plan for [Spec 008](./spec.md)
**Goal:** Build a declarative workflow engine that subscribes to the event stream, runs workflow instances, invokes use cases, enforces human gates, and emits engine events for observability. v0 ships a single workflow: `lead-to-payment`.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), Spec 001–007 contracts.
**Version:** 0.1.0
**Last updated:** 2026-06-21

> **Pre-conditions for build authorization.** This plan activates only after (a) Spec 008 is ratified, (b) an ADR moves the Workflow Engine into the [Roadmap](../../docs/roadmap.md) Phase 2 slot, and (c) stewards approve the move. Until then, this file is planning, not authorization.

---

## 0. Q resolutions (from Spec 008 §13)

- **Q1 (format):** JSON. Zero deps; native to Node 22.
- **Q2 (package layout):** New package `packages/workflow-engine/`. Peer to `@daedalus/revenue-visibility`; **not** part of `@daedalus/core`.
- **Q3 (instance discovery):** By `correlationId` of the incoming event. If no instance exists and the event matches a workflow's initial trigger, a new instance starts.
- **Q4 (compensation events):** Explicit per transition. The engine emits `LeadDiscarded`, `ProposalRejected`, `InvoiceOverdue`, etc. — the named events already in the catalog.
- **Q5 (multi-tenant):** Per-workflow-type with tenant overrides. Tenant 0 inherits the default.
- **Q6 (polling):** Polling in v0. Replayable as the primitive; efficiency is a follow-up.
- **Q7 (time-based):** Out of scope for v0. Reserved for a future spec.

---

## 1. Architecture

```
packages/workflow-engine/                       # NEW package
  src/
    domain/
      workflow.ts             # Workflow artifact type (read-only view)
      instance.ts             # Instance state (read-only view)
      guard.ts                # Guard evaluation (pure, no I/O)
      policy.ts               # PolicyDecisionPort (no-op in v0)
    application/
      engine.ts               # The engine loop (boot, subscribe, evaluate, fire)
      use-cases.ts            # resolveUseCase(name) → invocable use case
      transitions.ts          # evaluate(event, instance) → matched transitions
      compensation.ts         # walk back active transitions, emit cancellations
      lineage.ts              # helpers (uses @daedalus/core startLineage, followFrom)
      deps.ts                 # EngineDeps: EventStorePort + PolicyDecisionPort + clock + id + use-case registry
      ports/
        policy.ts             # PolicyDecisionPort interface
    adapters/
      jsonl-workflow-store.ts # Reads blueprints/workflows/*.json and config/tenants/<t>/workflows.json
      jsonl-instance-store.ts # Writes .data/tenants/<t>/workflow-instances.jsonl
    cli.ts                    # entry point: `node packages/workflow-engine/src/cli.ts run --tenant tenant-0`
  tests/                      # AC-1..AC-10 + workflow validation
  package.json                # no `dependencies`; peer deps: @daedalus/core

blueprints/workflows/                          # NEW — default workflow artifacts
  lead-to-payment.v0.1.0.json
  ... (versioned, immutable)

config/tenants/tenant-0/workflows.json         # NEW — Tenant 0 overrides (empty in v0; inherits defaults)

.data/tenants/<tenant>/workflow-instances.jsonl  # per-tenant instance log (gitignored)

apps/cli/src/index.ts                          # + 2 commands: human:approve, human:reject
```

### Dependency rule (unchanged from ADR-003/004)

- `packages/workflow-engine` → `@daedalus/core` (use cases, types) and the public contracts of modules.
- `@daedalus/core` is **unchanged** (Spec 008 §11: zero new Core primitives).
- `apps/cli` adds two new commands that emit `HumanApproved` / `HumanRejected`. No changes to existing commands.

---

## 2. CLI commands added (driving-side, for human gates)

The engine needs a way for humans to approve pending transitions. The CLI gets two new commands:

| Command | Effect |
|---|---|
| `human:approve --tenant <t> --workflow <w> --instance <corr>` | Emit `HumanApproved` for the named pending transition. |
| `human:reject  --tenant <t> --workflow <w> --instance <corr> --reason <r>` | Emit `HumanRejected` for the named pending transition. The engine then triggers compensation. |

These are the **only** ways to clear a `HumanApprovalRequired` gate in v0.

> **No other CLI commands change.** Writes for `lead:create`, `proposal:approve`, `payment:record`, etc. continue to flow through the existing commands. The engine reacts to the events those commands emit.

---

## 3. The first workflow shipped: `lead-to-payment` v0.1.0

Conceptual shape (matches Spec 008 §9):

```
Workflow: lead-to-payment v0.1.0
Initial:  draft
Terminal: closed, compensated

States:
  draft:
    on LeadQualified → [qualified]
  qualified:
    on ProposalGenerated → [proposed]
  proposed:
    on ProposalSubmitted → [submitted]
    on ProposalRejected  → [rejected]   (terminal; compensate via emit ProposalRejected)
  submitted:
    on ProposalApproved  → [approved]
    on ProposalRejected  → [rejected]
  approved:
    on ProjectCreated    → [projected]  (action: createProjectUseCase; triggered by Core reactor on ProposalApproved)
  projected:
    on ProjectDelivered  → [delivered]
  delivered:
    on InvoiceIssued     → [invoiced]
  invoiced:
    on InvoicePaid       → [paid]
  paid:
    on ProjectClosed     → [closed]    (terminal; requiresHuman)
  rejected: {}
  closed: {}
```

> **Note.** v0.1.0 of this workflow is **observational** — it doesn't itself *create* projects. The existing Core reactor (`createProjectUseCase` from `ProposalApproved`) already creates the project (Spec 006 §3). The workflow records the state transition. The engine's value in v0 is **observability + human-gate enforcement at the closed step**, not duplicating Core's reactors. **v0.2.0** of the workflow (a future spec) will own the action invocations explicitly and the engine will suppress Core's standalone reactor on ProposalApproved for tenants running this workflow.

> **Human gate.** Only `paid → closed` requires human approval (per Spec 006 AC-3: closing a project with unpaid invoices is an explicit human decision with a reason recorded). v0 enforces this gate.

---

## 4. Engine loop (pseudocode — *not* code in this plan)

```
async function runEngine(deps, tenantId):
  workflows = loadWorkflows(tenantId)            # default + tenant overrides
  policy    = deps.policy                         # no-op in v0
  clock     = deps.now
  newId     = deps.newId

  lastSeenAt = readLastSeenAt(tenantId)           # recover from .data/tenants/<t>/.engine-cursor

  loop:
    events = await deps.eventStore.readStream(tenantId, since: lastSeenAt)
    for event in events:
      lastSeenAt = event.occurredAt
      await dispatch(event, workflows, policy, deps)
    sleep(pollInterval)
```

```
async function dispatch(event, workflows, policy, deps):
  # Find or create instance for this event's correlationId
  instance = findInstance(event.correlationId, tenantId)

  for workflow in workflows:
    if not instance and matchesInitial(workflow, event):
      instance = startInstance(workflow, event, deps)
      await record(WorkflowInstanceStarted(...))

    if not instance:
      continue

    matched = evaluateTransitions(workflow, instance, event)

    for transition in matched:
      if transition.requiresHuman and not hasHumanApproval(event, instance):
        emit HumanApprovalRequired
        continue

      decision = await policy.decide(transition, event, instance)
      if decision.denied:
        emit HumanApprovalRequired with denial reason
        continue

      try:
        results = await invokeActions(transition, event, instance, deps)
        emit WorkflowTransitionFired with results lineage
        advance(instance, transition)
        if transition.terminal:
          emit WorkflowInstanceCompleted
      catch error:
        await compensate(instance, transition, error, deps)
        emit WorkflowInstanceCompensated
```

---

## 5. Workflow artifact (concrete example for `lead-to-payment`)

The JSON shape for `lead-to-payment.v0.1.0.json` follows Spec 008 §9. The actual file lives at `blueprints/workflows/lead-to-payment.v0.1.0.json`. The plan does **not** commit it here — it ships with the implementation PR.

---

## 6. Engine events (the engine's own observable vocabulary)

These are emitted by the engine and recorded in the per-tenant event stream. They are **not** value-chain events; they are engine observability events. They follow the lineage discipline.

| Engine event | Emitted when |
|---|---|
| `WorkflowInstanceStarted` | New instance created on a matching initial event. |
| `WorkflowTransitionFired` | A transition fires; carries `workflowName`, `version`, `fromState`, `toState`, `actionUseCases[]`, and the correlation id of any value-chain events emitted by the actions. |
| `HumanApprovalRequired` | A transition is matched but waiting on a human. |
| `HumanApproved` | A human approves a pending transition (via CLI). |
| `HumanRejected` | A human rejects a pending transition (via CLI). |
| `WorkflowInstanceCompleted` | Instance reaches a terminal state (e.g. `closed` or `rejected`). |
| `WorkflowInstanceCompensated` | Compensation ran. Carries the compensated transition and the cancellation event id. |

All eight are part of the **engine event vocabulary**. They are introduced by this spec — they are *engine* events, not value-chain events, and so do not violate Spec 008 §11's "no new Core events" rule (the engine is a peer to Core, not part of it).

---

## 7. Acceptance criteria → test mapping

| Spec 008 AC | Test |
|---|---|
| AC-1 (declarative advancement) | `tests/engine-declarative.test.ts` |
| AC-2 (idempotency) | `tests/engine-idempotency.test.ts` |
| AC-3 (action invocation) | `tests/engine-actions.test.ts` |
| AC-4 (human gate) | `tests/engine-human-gate.test.ts` |
| AC-5 (compensation) | `tests/engine-compensation.test.ts` |
| AC-6 (versioning) | `tests/engine-versioning.test.ts` |
| AC-7 (multi-tenant) | `tests/engine-multi-tenant.test.ts` |
| AC-8 (auditability) | `tests/engine-audit.test.ts` |
| AC-9 (policy seam) | `tests/engine-policy-seam.test.ts` |
| AC-10 (zero Core change) | `tests/engine-zero-core-change.test.ts` (greps for forbidden imports) |

---

## 8. Evidence run (end-to-end, v0)

```
# Setup: tenant-0 already has the 19-event seed from Spec 007.

# Terminal 1 — engine
node packages/workflow-engine/src/cli.ts run --tenant tenant-0 --poll-ms 200

# Terminal 2 — CLI
# Approve the ProjectClosed transition (the only human-gated step in v0)
node apps/cli/src/index.ts human:approve \
  --tenant tenant-0 \
  --workflow lead-to-payment \
  --instance corr-acme-001

# Verify
node apps/cli/src/index.ts events --tenant tenant-0 | tail -20
# Should include: WorkflowInstanceStarted, WorkflowTransitionFired (×N),
# HumanApprovalRequired, HumanApproved, WorkflowInstanceCompleted.

# Or open ATLAS (already running):
open http://localhost:8788/t/tenant-0/events
# Engine events appear interleaved with value-chain events, full lineage.
```

> **ATLAS Phase 2 panels (Active Processes / Workflow Metrics)** are not in this PR — they belong to a future v0 spec for ATLAS Phase 2 (gated on this engine shipping). For v0 of the engine, ATLAS reads engine events through the existing `/events` and `/activity` panels.

---

## 9. Definition of done (v0)

- All 10 ACs covered by `node --test`.
- One workflow shipped (`lead-to-payment` v0.1.0).
- Engine emits the eight engine events with full lineage.
- Human gate enforced on `paid → closed`.
- Compensation works for a single-step failure (AC-5).
- Multi-tenant: Tenant 0 + Tenant other both boot with no cross-leakage.
- Zero new Core events, aggregates, projections, ports (AC-10).
- `packages/workflow-engine/package.json` declares zero `dependencies`.
- `.data/tenants/<tenant>/workflow-instances.jsonl` is gitignored.
- The 88 + 26 existing ATLAS tests stay green.

---

## 10. Out of scope (binding — from Spec 008 §11, §14)

- No saga / distributed coordination.
- No external scheduler / cron.
- No visual designer.
- No workflow versioning migration tools.
- No policy engine in v0 (the seam exists; the implementation is Phase 3).
- No agent runtime.
- No new Core events / aggregates / projections.
- No modifications to existing modules' use cases.

---

*Subordinate to [Spec 008](./spec.md), the [Constitution](../../memory/constitution.md), and the [Technical Principles](../../memory/technical-principles.md). Planning only — not a build authorization.*