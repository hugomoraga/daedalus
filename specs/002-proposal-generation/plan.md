# Plan — Proposal Generation v1 (orchestrated form)

**Status:** Ratified · implementation plan for [Spec 002](./spec.md) v1.0
**Goal:** Make the two transition points the Workflow Engine can drive automatic: `LeadQualified` → auto-start-draft, and `ProposalApproved` → auto-create-project. The human-decision steps (add-item, set-scope, finalize, submit, approve, reject) remain manual.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), [Spec 008 — Workflow Engine](../008-workflow-engine/spec.md) (just shipped)
**Version:** 1.0.0
**Last updated:** 2026-06-21

> The `/plan` step for v1: *how* we extend Proposal Generation to its orchestrated form on top of the shipped engine. The v0 implementation (this package, the CLI commands, the audit trail) is unchanged; v1 adds two **workflow actions** and one **engine-level wiring change**.

---

## 0. Q resolutions (from Spec 002 §12 + new v1 questions)

- **Q1 (draft as first-class):** unchanged from v0.
- **Q2 (currency):** unchanged — Tenant 0 currency.
- **Q3 (revision history):** unchanged — finalized snapshot only.
- **Q4 (template authoring):** unchanged — Tenant-scoped, out of module core.
- **Q5 (expectedValue on Core event):** deferred — separate ADR if promoted (T-13 in tasks).
- **Q6 (drafting AI):** out of v1 — Phase 4.
- **Q7 (v1 orchestration scope — new):** two auto-steps: `LeadQualified` → `startDraftUseCase`; `ProposalApproved` → `createProjectUseCase`. Nothing else automated (Article V).
- **Q8 (v1 module use cases in the engine — new):** the engine's `UseCaseRegistry` is built by the composition root; module use cases join Core use cases. Each module invoker carries its own deps (e.g. `DraftStorePort`) at registry-construction time. The engine itself stays Core-only.

---

## 1. What v1 changes

| Layer | Change |
|---|---|
| `@daedalus/proposal-generation` | **No code changes** — `startDraftUseCase` is already exported. |
| `@daedalus/core` | **No code changes** — `createProjectUseCase` is already exported. |
| `packages/workflow-engine` | **Add `proposalGenerationUseCases(propGenDeps)` factory** that wraps `startDraftUseCase` into the engine's `UseCaseRegistry`. (Pattern mirrors `coreUseCases(coreDeps)` from PR #28.) |
| `blueprints/workflows/` | **Add `lead-to-payment.v0.2.0.json`** with two transitions owning the actions above. v0.1.0 stays unchanged (existing instances continue under v0.1.0; AC-6). |
| `config/tenants/tenant-0/workflows.json` | Unchanged (`[]`); v0.2.0 will be picked up automatically. |

The audit trail already records the auto-actions via `WorkflowTransitionFired.payload.actionEventIds` (Spec 008 AC-3) — no additional event types required.

---

## 2. The new workflow artifact — `lead-to-payment.v0.2.0.json`

Identical shape to v0.1.0 (Spec 008 §9) with two transitions gaining `actions`:

```diff
   draft: {
     on: {
-      LeadQualified: [{ id: "draft-to-qualified", target: "qualified" }]
+      LeadQualified: [{
+        id: "draft-to-qualified",
+        target: "qualified",
+        actions: [{ useCase: "startDraftUseCase", args: { _event: true } }]
+      }]
     }
   },
   ...
   submitted: {
     on: {
-      ProposalApproved: [{ id: "submitted-to-approved", target: "approved" }]
+      ProposalApproved: [{
+        id: "submitted-to-approved",
+        target: "approved",
+        actions: [{ useCase: "createProjectUseCase", args: { _event: true } }]
+      }]
     }
   },
```

`args: { _event: true }` copies the triggering event's payload into the command (Spec 002 v0.1.0 `buildCommand` semantics). For `LeadQualified` this gives `{ leadId, tenantId }`; the workflow hard-codes `template: "standard"` in a follow-up step (see §3).

### Why not auto-finalize / auto-submit / auto-approve?
Constitution Article V (Human Responsibilities) — irreversible/strategic decisions stay with humans. Spec 008 §11 non-goal "no agent runtime". The two auto-steps above are mechanical bookkeeping (create draft, create project); the lifecycle decisions are not.

---

## 3. Composition-root wiring (engine CLI)

`packages/workflow-engine/src/cli.ts` currently builds the registry as `coreUseCases(core)`. v1 extends it:

```diff
-  useCases: coreUseCases(core),
+  useCases: {
+    ...coreUseCases(core),
+    startDraftUseCase: async (cmd, runtime) =>
+      startDraftUseCase(
+        { ...runtime, draftStore: new JsonFileDraftStoreAdapter(process.cwd()) },
+        cmd as Parameters<typeof startDraftUseCase>[1],
+      ).then(() => undefined),
+  },
```

(Or, cleaner, expose a `proposalGenerationUseCases(propGenDeps)` factory analogous to `coreUseCases`. Implementation picks the cleaner of the two — see tasks §2.)

The `apps/cli` CLI is unchanged — `proposal:start`, `proposal:finalize`, etc. still work manually for tenants not running the v0.2.0 workflow (or for tenants whose workflow v0.2.0 is overridden).

---

## 4. Acceptance-criteria → test mapping

| Spec 002 AC | Covered by |
|---|---|
| AC-1..AC-9 (v0) | Already green — `tests/proposal-generation.test.ts` (unchanged) |
| AC-10 (orchestrated auto-start) | New: `tests/proposal-generation-orchestrated.test.ts` |
| AC-11 (orchestrated auto-project) | Same new file (both ACs in one scenario) |
| AC-6 from Spec 008 (versioning) | Already green — `tests/engine-versioning.test.ts` (v0.1.0 in-flight instances stay on v0.1.0) |

The new test sets up a temp dir with both v0.1.0 AND v0.2.0 of the workflow; seeds `LeadQualified`; asserts:
1. The engine emits `WorkflowTransitionFired` for `draft-to-qualified` whose `actionEventTypes = ["ProposalDraftCreated"]`.
2. A `ProposalDraftCreated` event is appended to the stream for that flow.
3. Then seed `ProposalApproved`; assert `WorkflowTransitionFired` for `submitted-to-approved` whose `actionEventTypes = ["ProjectCreated"]`.

---

## 5. Definition of done (v1)

- `blueprints/workflows/lead-to-payment.v0.2.0.json` shipped.
- `proposalGenerationUseCases(...)` (or equivalent wiring in the engine CLI) shipped.
- New test file covers AC-10 + AC-11.
- `node --test` — 127 (current) + 2 = 129+ tests, all green.
- `@daedalus/core` unchanged.
- `@daedalus/proposal-generation` unchanged (only the existing exports are wired into the engine registry).
- Manual CLI commands still work (`proposal:start` / `project:create`) for non-v0.2.0 tenants and as a manual escape hatch.

---

## 6. Out of scope (binding — from Spec 002 §13)

- No auto-finalize, auto-submit, auto-approve (Constitution Article V).
- No richer tenant templates (T-12 — separate, requires Tenant 0 to author).
- No `expectedValue` on Core event schema (T-13, Q5 — separate ADR if promoted).
- No AI drafting assistance (T-14, Q6 — Phase 4).

---

## 1. Technical context (per the framework)

| Decision | Choice | Source |
|---|---|---|
| Language / runtime | TypeScript on Node.js | confirmed |
| Architecture | **Hexagonal** — Domain / Application / Ports / Adapters | Technical Principles §2 |
| Interface | **CLI** as first driving adapter, **no business logic** | Technical Principles · First-Phase |
| Persistence | **JSONL append-only, one file per tenant**, behind a port | Technical Principles · First-Phase |
| Event store | **`EventStorePort`** + **`JsonlEventStoreAdapter`** | Technical Principles · First-Phase |
| Dependencies | Minimal / zero external (`fs`, `node:test`, `node:util`) | Simplicity First |
| Testing | `node:test` encoding Spec 002 acceptance criteria | — |

---

## 2. Architecture — hexagonal in a modular monorepo

Built as a modular monorepo per [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md). `apps → packages`; within a package `adapters → application → domain`. `@daedalus/core` depends on nothing.

```
apps/cli/src/index.ts              # driving adapter: parse args -> Command -> use case -> render. NO logic.
packages/core/                     # @daedalus/core
  src/domain/                      #   event.ts, value-chain.ts, lead.ts (pure)
  src/application/                 #   create-lead, qualify-lead, projections, lineage, deps (CoreDeps)
  src/application/ports/           #   event-store.ts (EventStorePort)
packages/proposal-generation/      # @daedalus/proposal-generation (depends on core)
  src/domain/                      #   proposal-draft.ts, events.ts, value-objects.ts
  src/application/                 #   start/add-item/set-scope/finalize/discard, deps (ProposalDeps)
  src/application/ports/           #   draft-store.ts (DraftStorePort)
  src/adapters/                    #   json-draft-store.ts (module-specific driven adapter)
packages/jsonl-event-store/        # @daedalus/jsonl-event-store (shared driven adapter, impl EventStorePort)
config/tenants/tenant-0.ts         # currency, enabled modules (Tenant layer; NO PII)
.data/                             # gitignored: tenants/<id>/events.jsonl, tenants/<id>/drafts/<id>.json
```

> **Two ports, both earning their place** (Technical Principles §2, "ports earn their place"):
> - `EventStorePort` — the audit log; clearly swappable (SQLite/Postgres later).
> - `DraftStorePort` — the **mutable work-area**. Per Spec 002 §6, draft edits emit **no events** (to avoid log noise), so the working draft is *not* event-sourced; it needs its own persistence. Isolating it behind a port keeps the domain/use cases pure and the non-event state explicitly contained. This is a deliberate, documented exception to pure event-sourcing, scoped to the draft only.
>
> `id` and timestamp generation are passed into use cases as **injected functions** (not full ports) for test determinism — deliberately not over-abstracted.

### The canonical chain this slice proves
```
Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI
```

---

## 3. CLI commands (v0)

| Command | Use case | Emits / does |
|---|---|---|
| `lead:create --tenant t0 --customer "<name>"` | create-lead | `LeadCreated` (Core seed) |
| `lead:qualify --tenant t0 --lead <id>` | qualify-lead | `LeadQualified` (Core seed) |
| `proposal:start --tenant t0 --lead <id> --template <name>` | start-draft | `ProposalDraftCreated`; creates work-area |
| `proposal:add-item --tenant t0 --draft <id> --label "<l>" --amount <n>` | add-line-item | mutate draft (**no event**) |
| `proposal:set-scope --tenant t0 --draft <id> --text "<s>"` | set-scope | mutate draft (**no event**) |
| `proposal:show --tenant t0 --draft <id>` | (read) | print draft work-area |
| `proposal:finalize --tenant t0 --draft <id>` | finalize-draft | `ProposalDraftFinalized` + **one** `ProposalGenerated(expectedValue)` |
| `proposal:discard --tenant t0 --draft <id>` | discard-draft | `ProposalDraftDiscarded` |
| `events --tenant t0` | (read) | dump append-only log (**the evidence**) |

> **Lead seed is minimal, not a CRM** (review M2): two flat commands existing only to satisfy the "draft starts from a qualified lead" precondition. No pipeline/scoring/capture.
> **Cross-module contract** (review M3 / Spec 002 Q5): `ProposalGenerated` carries optional `expectedValue { amount, currency }` = sum of line items in tenant currency. No pricing engine, no tax.

---

## 4. Build steps (lean, inside-out per hexagonal)

1. **Domain core** — `Event` + lineage value objects; `value-chain` event factories; minimal `Lead` aggregate. *Pure, no I/O.*
2. **Ports** — define `EventStorePort` and `DraftStorePort` interfaces in `application/ports`.
3. **JSONL adapter** — `JsonlEventStoreAdapter` (append + readStream, tenant-scoped file). Test: append never mutates prior lines; readStream replays in order.
4. **Core seed use cases** — `create-lead`, `qualify-lead`. Test: a draft cannot start from an unqualified lead (AC-1 negative).
5. **Proposal draft domain + use cases** — `proposal-draft` aggregate, value objects; `start-draft`, `add-line-item`, `set-scope`. Test: edits go through `DraftStorePort`, emit no events (AC-4); start emits `ProposalDraftCreated` (AC-1).
6. **Finalize + discard use cases** — `finalize-draft` emits `ProposalDraftFinalized` + exactly one `ProposalGenerated` with `expectedValue` (AC-3, AC-5, R1); draft becomes non-editable. `discard-draft` emits `ProposalDraftDiscarded`, no Core Proposal (AC-6).
7. **CLI driving adapter** — `parseArgs` dispatch; builds Command DTOs; calls use cases; renders. `events` dumps the log. *No business logic in CLI.*
8. **Evidence run + isolation + replay** — scripted end-to-end session (below); two-tenant isolation (AC-9); full-log replay reconstructs state (AC-7).
9. **`.gitignore`** — add `.data/` (no runtime/tenant data, no PII in VC).

---

## 5. The evidence we capture (the point)

A recorded end-to-end session (synthetic data only), committed as a transcript:

```
lead:create   t0 "ACME (mock)"        -> LeadCreated
lead:qualify  t0 <leadId>             -> LeadQualified
proposal:start t0 <leadId> standard   -> ProposalDraftCreated
proposal:add-item t0 <draftId> "Discovery" 1200
proposal:add-item t0 <draftId> "Build" 4800
proposal:finalize t0 <draftId>        -> ProposalDraftFinalized + ProposalGenerated(expectedValue=6000)
events t0                             -> append-only audit trail printed
```

Demonstrates the canonical chain end to end: tenant-scoped immutable events, the read-model draft (no event noise), the clean Module→Core handoff, and the `expectedValue` contract ready for Revenue Visibility. **This is the validation evidence** — concrete, auditable, replayable, and reusable for any future module.

---

## 6. Acceptance-criteria → test mapping

| Spec 002 AC | Covered by |
|---|---|
| AC-1 (start from qualified lead; reject otherwise) | Steps 4 + 5 |
| AC-3 (expectedValue = sum of items, no tax) | Step 6 |
| AC-4 (edits emit no event) | Step 5 |
| AC-5 (finalize → single ProposalGenerated) | Step 6 (R1) |
| AC-6 (discard, no Core Proposal) | Step 6 |
| AC-7 (auditability; replay reconstructs) | Steps 3 + 8 |
| AC-8 (expectedValue contract for RV) | Step 6 (emits contract; consumed when Spec 001 is built) |
| AC-9 (tenant isolation) | Step 8 |

---

## 7. Scope guardrails (do NOT build in v0)

- No CRM/pipeline/scoring (lead seed = two flat commands).
- No pricing engine, discounts, or tax (`expectedValue` is a sum).
- No sending, e-signature, or contract generation.
- No AI drafting; no orchestration/workflow engine (Phase 2).
- No UI; no real client data / PII (`.data/` gitignored; templates are mock).
- No Revenue Visibility implementation here (v0 only emits the contract).
- From the framework's "avoid" list: no CQRS, sagas, DI framework, relational DB, event bus, etc.

---

## 8. Definition of done (v0)

- The canonical chain `Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI` runs cleanly for the evidence session.
- All acceptance-criteria tests pass (`node --test`).
- Finalize emits exactly one `ProposalGenerated` carrying `expectedValue`.
- State is reconstructable by replaying the JSONL log; two tenants show zero cross-leakage.
- CLI contains no business logic; domain knows nothing of JSONL.
- `.data/` gitignored; no PII in the repo.

---

*Subordinate to [Spec 002](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Implementation plan only — the build is the next step.*
