# ADR-006 — Adopt the Workflow Engine (Phase 2)

**Status:** Proposed
**Date:** 2026-06-21
**Deciders:** Stewards
**Trigger:** [Spec 008](../../specs/008-workflow-engine/spec.md) (PR #20, pending); [Roadmap](../../docs/roadmap.md) Phase 1 closed.
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-004](./ADR-004-export-discipline-and-lineage.md), [ADR-005](./ADR-005-atlas-driving-adapter.md), Spec 001–007 contracts

---

## Context

Daedalus's value chain `Lead → Payment` is closed in Core (Spec 006). Three modules consume it (Spec 001–003). Every transition is currently **driven manually** through the CLI; a human shepherds each step. The Roadmap names Phase 2 as the moment when **process becomes declarative**: workflows describe transitions, the engine reacts to events.

The Technical Principles §"Avoid for now" list explicitly includes **"Sagas"** and **"Workflow Engine"** as items deferred pending evidence. That evidence is now in place:

- The event stream is the source of truth (ADR-004 lineage discipline).
- The Core value-chain use cases are stable and idempotent (Spec 006).
- Three modules expose projections and use cases for the engine to compose.
- A read-only mission-control surface (ATLAS, ADR-005) exists to make engine events visible.

Spec 008 (PR #20) defines the engine: a peer to the CLI that subscribes to the event stream, evaluates workflow artifacts against new events, invokes use cases, enforces human gates, and emits its own engine events for observability. It runs in-process, polls the stream, has a `PolicyDecisionPort` seam (no-op in v0; Phase 3 plugs in), and is multi-tenant by default.

This ADR records the architectural decision: **adopt the Workflow Engine as defined in Spec 008**, place it in **Phase 2** of the Roadmap, and **conditionally retire** the "Workflow Engine" and "Sagas" items from the Avoid-for-now list — for the engine as specified, not as a general reversal.

---

## Decision

1. **Adopt the Workflow Engine** as described in [Spec 008](../../specs/008-workflow-engine/spec.md). The engine is a **peer to the CLI**, not part of `@daedalus/core`.

2. **Place the engine in Phase 2** of the [Roadmap](../../docs/roadmap.md), after the Phase 1 module milestones. Phase 2 was reserved for this capability in the original Roadmap; this ADR activates it.

3. **Conditionally retire** the **"Workflow Engine"** and **"Sagas"** items from the Technical Principles §"Avoid for now" list. The retirement applies **only** to the engine as defined in Spec 008. The general principle against premature complexity stands; this is a named exception, not a blanket reversal.

4. **Engine package:** `packages/workflow-engine/`. Peer to `@daedalus/revenue-visibility`. **Zero** new Core primitives (AC-10). The engine consumes existing use cases through the public contracts of `@daedalus/core` and the modules, via package entry points only (ADR-004).

5. **Workflows are versioned JSON artifacts** declared in `blueprints/workflows/<name>.<version>.json`. Tenant-specific overrides live in `config/tenants/<tenant>/workflows.json`. The engine refuses to start with a malformed workflow artifact (fail closed).

6. **The first shipped workflow is `lead-to-payment` v0.1.0** — observational in v0.1.0 (records state transitions without owning actions; Core's standalone reactor on `ProposalApproved` continues to fire). **v0.2.0** of the workflow (a future spec) will own action invocations explicitly. This staged approach keeps the v0 surface small and avoids overlapping with Core's existing reactors.

7. **Human gates** are enforced by the engine from day one. Two new CLI commands — `human:approve` and `human:reject` — are the **only** paths to clear a `HumanApprovalRequired` gate in v0. The engine never auto-fires a transition marked `requiresHuman: true`.

8. **`PolicyDecisionPort` seam is wired but no-op in v0.** A denial returns `HumanApprovalRequired` (not silent skip). Phase 3's policy engine plugs in here; the call signature is stable so the migration is mechanical.

9. **Compensation is explicit.** Each transition declares its compensating action in the artifact. The engine emits the named cancellation events from the [Event Catalog](../../docs/event-catalog.md) (`LeadDiscarded`, `ProposalRejected`, `InvoiceOverdue`, etc.) — **no** new event types in v0.

10. **The engine emits its own observability events** (`WorkflowInstanceStarted`, `WorkflowTransitionFired`, `HumanApprovalRequired`, `HumanApproved`, `HumanRejected`, `WorkflowInstanceCompleted`, `WorkflowInstanceCompensated`) with full lineage per ADR-004. These are **engine events**, not value-chain events; they do not violate Spec 008 §11's "no new Core events" rule.

11. **Multi-tenant by construction.** Tenant isolation is enforced structurally (per-tenant workflow load, per-tenant instance log, per-tenant engine cursor). AC-7 covers it.

---

## Consequences

**Positive**

- **Orchestrated value chain.** A single workflow artifact describes `Lead → Payment`. The engine reacts to events and advances state — the operator's manual shepherding is replaced by declarative automation, with human gates preserved (Constitution Article V).
- **Compensation is first-class.** Unhappy paths are not special-cased; each transition names its compensating action and the engine walks back on failure. Auditability by Default (Principle 4) is amplified.
- **Phase 2 unblocks Phase 2 panels of ATLAS** (`active-processes`, `queue-status`, `workflow-metrics`) without re-litigating the engine design — those are a follow-up spec gated on this engine shipping.
- **Phase 2 unblocks Spec 002 v1** (orchestrated Proposal Generation) and the resolution of **Spec 003 v1** (Discovery vs Engagement boundary).
- **Reuses Canon discipline.** Hexagonal layering, lineage, export discipline (ADR-004), zero external runtime deps. No new patterns introduced.
- **Policy seam ready for Phase 3.** The `PolicyDecisionPort` is wired; the v0 no-op returns `allow` for non-flagged actions. Phase 3's policy engine plugs in without restructuring.

**Negative / risks** (full enumeration in Spec 008 §12)

- *Premature complexity.* The engine is a substantial capability. **Mitigation:** AC-10 (zero new Core primitives); the first workflow is the simplest useful one (`lead-to-payment` v0.1.0); complexity follows usage.
- *Hidden coupling.* A workflow that hard-codes a module-specific use case creates coupling. **Mitigation:** Workflows reference use cases by name (string); the engine resolves them at boot. Mismatches fail closed at boot, not silently mid-flight.
- *Idempotency drift.* **Mitigation:** AC-2 + Core's existing use-case idempotency + the engine's instance log records fired transitions.
- *Compensation correctness.* **Mitigation:** Compensation is explicit in the artifact (no automatic inference). AC-5 covers single-step compensation; multi-step chains validated in tests.
- *Human-gate circumvention.* **Mitigation:** AC-4 + the engine's `requiresHuman` discipline; v0 ships with explicit author discipline, Phase 3 will add a linter for irreversible transitions.
- *Policy seam left unused.* **Mitigation:** AC-9 exercises the seam in v0 (no-op returns `allow`); a test verifies the seam is called.
- *Version drift.* **Mitigation:** AC-6; old instances drain under their original version. The engine refuses to delete a version with in-flight instances unless a flag is set.

**Cost**

- New package `packages/workflow-engine/` with ~10 source files + ~10 test files.
- `blueprints/workflows/lead-to-payment.v0.1.0.json` artifact (~50 lines).
- Two new CLI commands (`human:approve`, `human:reject`).
- Per-tenant instance log `.data/tenants/<t>/workflow-instances.jsonl` (gitignored).
- Estimated ~10 new tests; existing 114 stay green.

---

## What this ADR does NOT do

- Does **not** authorize any change to `@daedalus/core` (Spec 008 AC-10).
- Does **not** authorize changes to existing modules' use cases. The engine consumes them; it does not modify them.
- Does **not** authorize a policy engine implementation (Phase 3). The seam exists; the implementation is a separate spec.
- Does **not** authorize an agent runtime (Phase 4) or any scheduler (time-based transitions, cron, etc.).
- Does **not** authorize a workflow versioning migration tool, a visual designer, or any external scheduler.
- Does **not** authorize new value-chain events. Compensation uses the named events already in the [Event Catalog](../../docs/event-catalog.md).
- Does **not** change the [Constitution](../../memory/constitution.md), [Identity](../../docs/identity.md), [Domain Model](../../docs/domain-model.md), or any ratified spec's intent.
- Does **not** retire "Workflow Engine" or "Sagas" from the Avoid-for-now list in general. The list keeps its teeth for any workflow-shaped work that does not match Spec 008's constraints.

---

## Acceptance (gate for steward ratification)

This ADR moves the Workflow Engine into Phase 2 only when **all** of the following hold:

1. **Spec 008 is ratified.** *(Pending — PR #20.)*
2. **This ADR is accepted.** *(Pending steward review.)*
3. **The founder (Tenant 0) confirms** the `lead-to-payment` v0.1.0 shape matches their operator needs (or approves the deviation).

T-01…T-27 in [Spec 008 tasks](../../specs/008-workflow-engine/tasks.md) may begin only after these three are satisfied.

---

## Companion change: Roadmap amendment

This ADR ships together with a minimal amendment to the [Roadmap](../../docs/roadmap.md):

- A new Phase 2 capability section: **Workflow Engine v0** — declarative orchestration of the value chain. Reference [Spec 008](../../specs/008-workflow-engine/spec.md) and [ADR-006](./ADR-006-adopt-workflow-engine.md).
- Existing Phase 2 module milestones (orchestrated Proposal Generation, Opportunity Discovery) are reframed as **consumers of** the engine, not parallel work.
- ATLAS Phase 2 panels (`active-processes`, `queue-status`, `workflow-metrics`) are listed as a follow-on milestone, gated on this engine shipping.
- No other sections of the Roadmap change.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Technical Principles](../../memory/technical-principles.md). A named exception to the "Avoid for now" list, not a reversal of the principle.*