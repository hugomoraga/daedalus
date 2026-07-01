# Tasks — Proposal Generation

**Status:** v0 shipped & green · **v1 SHIPPED** (orchestrated form — Spec 002 v1.0 + Plan 002 v1.0 ratified, T-15..T-18 ✅, PR #32) · **T-19 ✅** (ATLAS Phase 2 panels — Spec 007 Phase 2 / PR #69)
**Derives from:** [Spec 002](./spec.md) + [Plan 002](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 1.2.0
**Last updated:** 2026-07-01

> The `/tasks` step for Proposal Generation. v0 + v1 are both shipped and green. T-19 (ATLAS Phase 2 panels) also shipped, separately under [Spec 007 — Atlas UI](../007-atlas-ui/spec.md) Phase 2 / PR #69. The next increment (T-12 richer templates, T-13 expectedValue ADR, T-14 AI drafting) remains forward-planning and blocked on Phase 3+ capabilities.

---

## 1. Reality check (verified, not assumed)

Proposal Generation **v0 is built and passing** (`node --test` green across the suite, incl. `tests/proposal-generation.test.ts`). The packages `@daedalus/core`, `@daedalus/proposal-generation`, and the shared `@daedalus/jsonl-event-store` exist and exercise the canonical chain end to end. The tasks below record that as **done** (DoD per Plan §8) and scope the **next increment**.

---

## 2. v0 — DONE (Phase 1)

Each maps to a Spec 002 AC and a Plan 002 build step.

- [x] T-01: Domain core: `Event` + lineage value objects; value-chain factories; minimal `Lead` (AC-7)
- [x] T-02: Ports: `EventStorePort`, `DraftStorePort`
- [x] T-03: `JsonlEventStoreAdapter` (append-only, tenant-scoped, replayable) (AC-7)
- [x] T-04: Core seed use cases: `create-lead`, `qualify-lead`; reject draft from unqualified lead (AC-1)
- [x] T-05: Draft aggregate + `start` / `add-line-item` / `set-scope`; edits emit **no** event (AC-1, AC-4)
- [x] T-06: `finalize-draft` → `ProposalDraftFinalized` + exactly one `ProposalGenerated(expectedValue)` (AC-3, AC-5)
- [x] T-07: `discard-draft` → `ProposalDraftDiscarded`, no Core Proposal (AC-6)
- [x] T-08: CLI driving adapter (no business logic); `events` dumps the log
- [x] T-09: Evidence run + tenant isolation + full-log replay (AC-7, AC-8, AC-9)
- [x] T-10: `.gitignore` `.data/` (no PII / runtime data in VC)

**v0 Definition of Done (Plan §8): met.** Canonical chain runs, all ACs covered by tests, single `ProposalGenerated` with `expectedValue`, replay reconstructs state, zero cross-tenant leakage, CLI logic-free.

---

## 3. v1 — SHIPPED (Phase 2: orchestrated form)

Per Spec 002 v1.0 + Plan 002 v1.0 (ratified 2026-06-21), v1 adds the two auto-steps the Workflow Engine can drive. Implementation shipped in PR #32 (branch `029-spec002-v1-implementation`).

- [x] T-15: New workflow artifact `blueprints/workflows/lead-to-payment.v0.2.0.json` with two transitions owning actions (`LeadQualified` → `startDraftUseCase`, `ProposalApproved` → `createProjectUseCase`) (AC-10, AC-11)
- [x] T-16: Engine-side wiring: `proposalGenerationUseCases(propGenDeps)` factory + CLI wiring in `packages/workflow-engine/src/cli.ts` so `startDraftUseCase` joins the `UseCaseRegistry`; engine package.json adds `@daedalus/proposal-generation` dep (AC-10)
- [x] T-17: Test `tests/proposal-generation-orchestrated.test.ts` covering AC-10 (auto-draft on LeadQualified) + AC-11 (auto-project on ProposalApproved) + idempotency on replay (AC-10, AC-11)
- [x] T-18: Evidence run: tests above ARE the evidence run; AC-10 and AC-11 both verified end-to-end against the live engine (AC-10, AC-11)

### v1 DoD (Plan 002 v1 §5) — met

- `blueprints/workflows/lead-to-payment.v0.2.0.json` shipped.
- `proposalGenerationUseCases(...)` factory shipped + wired in the engine CLI.
- `tests/proposal-generation-orchestrated.test.ts` covers AC-10 + AC-11.
- `node --test` — 130/130 green (was 127; +3 new tests).
- `@daedalus/core` unchanged.
- `@daedalus/proposal-generation` unchanged (only its existing exports are wired into the engine registry).
- Manual CLI commands still work for non-v0.2.0 tenants and as a manual escape hatch.

### Engine change for v1 (T-16)

`buildCommand` in `packages/workflow-engine/src/application/transitions.ts` extended to support path expressions (`$.tenantId`, `$.payload.leadId`) so the workflow artifact can map event fields to use-case command arguments. Pure function, backward compatible with the previous `{ _event: true }` shape.

### Spec 008 boundary preserved

The engine stays Core-only. The `proposalGenerationUseCases` factory lives in the engine package because it's the natural composition point for the workflow registry, but it consumes `@daedalus/proposal-generation` via the module's public contract (`./adapters` subpath for the draft store) — no module internals are imported.

---

## 4. Phase 3+ — NOT STARTED (forward-planning only)

- [ ] T-12: Richer tenant templates (beyond the v0 mock `standard` template) — Tenant 0 profile supplies real templates; no Core change (blocked)
- [ ] T-13: Resolve Q5 — whether Core `ProposalGenerated` needs a formal `expectedValue` attribute vs the v0 optional payload (cross-module decision; **touches Core payload → ADR if promoted**, blocked)
- [ ] T-14: Drafting assistance as a bounded agent under policy (Q6) — **Agent runtime (Phase 4)** + **Policy engine (Phase 3)** — not built; future spec required (blocked)
- [x] T-19: ATLAS Phase 2 panels (`active-processes`, `queue-status`, `workflow-metrics`) — shipped in [Spec 007 — Atlas UI](../007-atlas-ui/spec.md) Phase 2 / PR #69 (the 3 panels live at `apps/atlas/src/panels/{active-processes,queue-status,workflow-metrics}.ts` and consume the engine projections from [Spec 011 — Workflow Engine Projections](../011-workflow-engine-projections/spec.md)). T-19 closed here as a follow-on dependency; the panels themselves are owned and tracked by Spec 007.

---

## 5. Out of scope (binding — from Spec 002 §13 + Plan 002 §6)

- No auto-finalize, auto-submit, auto-approve (Constitution Article V).
- No richer tenant templates in this increment (T-12).
- No `expectedValue` on Core event schema in this increment (T-13).
- No AI drafting assistance in this increment (T-14).
- No quoting/pricing engine, no tax, no e-sign, no send, no CRM/pipeline, no UI. Adding any requires a new spec, not a task here.

---

*Subordinate to [Spec 002](./spec.md) and [Plan 002](./plan.md). Tasks only — v0 is shipped; the next increment is gated on Phase 2+ capabilities.*