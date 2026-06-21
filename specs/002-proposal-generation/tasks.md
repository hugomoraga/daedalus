# Tasks — Proposal Generation

**Status:** v0 **shipped & green** · **v1 governance pack shipped** (Spec 002 v1.0 + Plan 002 v1.0 ratified 2026-06-21) · v1 implementation **next**
**Derives from:** [Spec 002](./spec.md) + [Plan 002](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 1.0.0
**Last updated:** 2026-06-21

> The `/tasks` step for Proposal Generation. v0 is shipped and green; v1 (orchestrated form) is the next increment. Tasks map 1:1 to Spec 002 acceptance criteria + Plan 002 build steps so progress stays traceable.

---

## 1. Reality check (verified, not assumed)

Proposal Generation **v0 is built and passing** (`node --test` green across the suite, incl. `tests/proposal-generation.test.ts`). The packages `@daedalus/core`, `@daedalus/proposal-generation`, and the shared `@daedalus/jsonl-event-store` exist and exercise the canonical chain end to end. The tasks below record that as **done** (DoD per Plan §8) and scope the **next increment**.

---

## 2. v0 — DONE (Phase 1)

Each maps to a Spec 002 AC and a Plan 002 build step. Status reflects the green test suite.

| ID | Task | Spec AC | Plan step | Status |
|---|---|---|---|---|
| T-01 | Domain core: `Event` + lineage value objects; value-chain factories; minimal `Lead` | AC-7 | 1 | ✅ |
| T-02 | Ports: `EventStorePort`, `DraftStorePort` | — | 2 | ✅ |
| T-03 | `JsonlEventStoreAdapter` (append-only, tenant-scoped, replayable) | AC-7 | 3 | ✅ |
| T-04 | Core seed use cases: `create-lead`, `qualify-lead`; reject draft from unqualified lead | AC-1 | 4 | ✅ |
| T-05 | Draft aggregate + `start` / `add-line-item` / `set-scope`; edits emit **no** event | AC-1, AC-4 | 5 | ✅ |
| T-06 | `finalize-draft` → `ProposalDraftFinalized` + exactly one `ProposalGenerated(expectedValue)` | AC-3, AC-5 | 6 | ✅ |
| T-07 | `discard-draft` → `ProposalDraftDiscarded`, no Core Proposal | AC-6 | 6 | ✅ |
| T-08 | CLI driving adapter (no business logic); `events` dumps the log | — | 7 | ✅ |
| T-09 | Evidence run + tenant isolation + full-log replay | AC-7, AC-8, AC-9 | 8 | ✅ |
| T-10 | `.gitignore` `.data/` (no PII / runtime data in VC) | — | 9 | ✅ |

**v0 Definition of Done (Plan §8): met.** Canonical chain runs, all ACs covered by tests, single `ProposalGenerated` with `expectedValue`, replay reconstructs state, zero cross-tenant leakage, CLI logic-free.

---

## 3. v1 — governance shipped; implementation NEXT (Phase 2: orchestrated form)

Per Spec 002 v1.0 + Plan 002 v1.0 (ratified 2026-06-21), v1 adds the two auto-steps the Workflow Engine can drive. Implementation is gated on shipping the engine (✅ shipped — PRs #26..#30).

| ID | Task | Spec AC | Plan §1 | Status |
|---|---|---|---|---|
| T-15 | New workflow artifact `blueprints/workflows/lead-to-payment.v0.2.0.json` with two transitions owning actions (`LeadQualified` → `startDraftUseCase`, `ProposalApproved` → `createProjectUseCase`) | AC-10, AC-11 | §1 | ⏸ |
| T-16 | Engine-side wiring: `proposalGenerationUseCases(propGenDeps)` factory (or equivalent CLI wiring) so `startDraftUseCase` joins the `UseCaseRegistry` | AC-10 | §3 | ⏸ |
| T-17 | Test `tests/proposal-generation-orchestrated.test.ts` covering AC-10 + AC-11 + the v0.1.0/v0.2.0 transition boundary (Spec 008 AC-6) | AC-10, AC-11 | §4 | ⏸ |
| T-18 | Evidence run: confirm both ACs end-to-end against the live engine | AC-10, AC-11 | §4 | ⏸ |

### v1 activation criteria — all satisfied

- ✅ Spec 002 v1.0 ratified (this document + spec.md bumped).
- ✅ Workflow Engine shipped ([Spec 008](../008-workflow-engine/spec.md) — PRs #26..#30 merged).
- ✅ Plan 002 v1.0 ratified.

T-15..T-18 authorized to build. Branch: `029-spec002-v1-implementation`.

---

## 4. Phase 3+ — NOT STARTED (forward-planning only)

| ID | Task | Depends on | Status |
|---|---|---|---|
| T-12 | Richer tenant templates (beyond the v0 mock `standard` template) | Tenant 0 profile supplies real templates; no Core change | ⛔ |
| T-13 | Resolve Q5 — whether Core `ProposalGenerated` needs a formal `expectedValue` attribute vs the v0 optional payload | Cross-module decision; **touches Core payload → ADR if promoted** | ⛔ |
| T-14 | Drafting assistance as a bounded agent under policy (Q6) | **Agent runtime (Phase 4)** + **Policy engine (Phase 3)** — not built; future spec required | ⛔ |
| T-19 | ATLAS Phase 2 panels (`active-processes`, `queue-status`, `workflow-metrics`) | Follow-on spec gated on engine shipping (now shipped) | ⏸ |

---

## 5. Out of scope (binding — from Spec 002 §13 + Plan 002 §6)

- No auto-finalize, auto-submit, auto-approve (Constitution Article V).
- No richer tenant templates in this increment (T-12).
- No `expectedValue` on Core event schema in this increment (T-13).
- No AI drafting assistance in this increment (T-14).
- No quoting/pricing engine, no tax, no e-sign, no send, no CRM/pipeline, no UI. Adding any requires a new spec, not a task here.

---

*Subordinate to [Spec 002](./spec.md) and [Plan 002](./plan.md). Tasks only — v0 is shipped; the next increment is gated on Phase 2+ capabilities.*
