# Tasks — Proposal Generation

**Status:** v0 **shipped & green** · next increment **not started**
**Derives from:** [Spec 002](./spec.md) + [Plan 002](./plan.md)
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md)
**Version:** 0.1.0
**Last updated:** 2026-06-13

> The `/tasks` step: the executable breakdown of Plan 002. The plan says *how*; this tracks *what is done and what remains*. Tasks map 1:1 to Spec 002 acceptance criteria and Plan 002 build steps so progress stays traceable.

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

## 3. Next increment — NOT STARTED (Phase 2: orchestrated form)

Per Spec 002 §13 and the [Roadmap](../../docs/roadmap.md), v0 is structured assembly; the **orchestrated** form matures in Phase 2 (react to events, move qualified leads toward proposals without manual shepherding). These are **not authorized to build yet** — they depend on capabilities not present.

| ID | Task | Source | Depends on / Blocked by |
|---|---|---|---|
| T-11 | Orchestrated flow: a reactor advances qualified leads toward drafts without manual CLI steps | Roadmap Phase 2 | **Workflow engine (Phase 2)** — does not exist yet |
| T-12 | Richer tenant templates (beyond the v0 mock `standard` template) | Spec 002 §4 (Tenant layer) | Tenant 0 profile supplies real templates; no Core change |
| T-13 | Resolve Q5 — whether Core `ProposalGenerated` needs a formal `expectedValue` attribute vs the v0 optional payload | Spec 002 §12 Q5 | Cross-module decision; **touches Core payload → ADR if promoted** |
| T-14 | Drafting assistance as a bounded agent under policy (Q6) | Spec 002 §12 Q6 | **Agent runtime (Phase 4)** + **Policy engine (Phase 3)** — not built; future spec required |

> **Scope guardrails still binding (Plan §7):** no quoting/pricing engine, no tax, no e-sign, no send, no CRM/pipeline, no UI. Adding any of these requires a new spec, not a task here.

---

## 4. Open decisions for a human

- **T-13 (Q5)** is the one that can quietly touch the Core. Do **not** add an `expectedValue` field to the Core `ProposalGenerated` schema without an ADR — it risks fixing commercial shape into the Core (ADR-001 territory). Flagged for steward decision.
- T-11 and T-14 are **blocked on engines that do not exist** (Workflow / Policy / Agent). Listing them is forward-planning, not a build authorization.

---

*Subordinate to [Spec 002](./spec.md) and [Plan 002](./plan.md). Tasks only — v0 is shipped; the next increment is gated on Phase 2+ capabilities.*
