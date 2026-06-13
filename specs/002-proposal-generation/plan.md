# Plan — Proposal Generation v0 (implementation)

**Status:** Draft · implementation plan for [Spec 002](./spec.md)
**Goal:** Get **real usage evidence** by building the smallest thing that works — not more conceptual modeling.
**Version:** 0.1.0
**Last updated:** 2026-06-13

> This is the `/plan` step: it defines *how* we build Proposal Generation v0. The spec defines *what*. Code is now in scope (the Phase 0 "no code" constraint is lifted for implementation). We build the leanest slice that produces an auditable event trail proving the Core → Module → Tenant model works end to end.

---

## 1. Technical context (decided)

| Decision | Choice | Why |
|---|---|---|
| Language / runtime | **TypeScript on Node.js** | Fast iteration, JSON-native (fits the event log), strong typing for domain + events. |
| Interface | **CLI** | The founder drives the real value chain and produces real events as evidence. No UI needed. |
| Event persistence | **Append-only JSONL log, one file per tenant** | Simplest thing honoring *Everything is an Event* + *Auditability*. Inspectable by eye; state = projection of the log. |
| Dependencies | **Minimal / zero external** for v0 | Node built-ins: `fs`, `node:test`, `node:util` (`parseArgs`). Keeps the first code clean and auditable. |
| Testing | **`node:test`** (built-in) | Encodes the Spec 002 acceptance criteria as runnable checks. |

---

## 2. Architecture — three layers, event-sourced

Mirrors the constitutional Core → Module → Tenant split *in code*.

```
src/
  core/
    event.ts           # Event shape + lineage (id, type, tenantId, ts, actor, cause, payload)
    event-log.ts       # append-only JSONL read/append, tenant-scoped
    projection.ts      # generic: rebuild state by replaying a tenant's log
    value-chain.ts     # Core event types: LeadCreated, LeadQualified, ProposalGenerated, ...
  modules/
    proposal-generation/
      draft.ts         # the draft work-area (read-model, mutable) + commands
      events.ts        # ProposalDraftCreated / Finalized / Discarded
      finalize.ts      # handoff: finalize -> emit the single Core ProposalGenerated
  tenants/
    tenant-0/
      config.ts        # currency, enabled modules (NO PII)
      templates/        # mock proposal templates (tenant data, not module code)
  cli/
    index.ts           # command dispatch (parseArgs)
data/                  # GITIGNORED — runtime event logs & draft work-areas (no real data in VC)
  tenants/<tenantId>/events.jsonl
  tenants/<tenantId>/drafts/<draftId>.json
```

> **Note on repo structure.** The existing top-level `domains/`, `modules/`, `tenants/` hold *conceptual docs*. Code lives under `src/` mirroring the same layers. `docs/repository-structure.md` should be updated to record `src/` + `data/` once code lands (small follow-up; not a blocker).

### Key implementation nuance — draft is a read-model, not an event stream
Per Spec 002 §6, editing a draft emits **no event**. So:
- The **draft working content** is a mutable file under `data/.../drafts/` (a work-area), rewritten on each edit. **Not** in the audit log.
- The **audit event log** receives only the deliberate milestones: `ProposalDraftCreated`, `ProposalDraftFinalized`, `ProposalDraftDiscarded`, and (on finalize) the Core `ProposalGenerated` carrying the finalized snapshot.
- Intermediate revisions are intentionally **not** audited (Spec 002 Q3: finalized snapshot only for v0).

### Cross-module contract (review M3 / Spec 002 Q5)
`ProposalGenerated` carries an **optional `expectedValue { amount, currency }`** built from the draft's pricing line items. This is the minimal payload contract so Revenue Visibility (Spec 001) can later consume it. **No pricing engine, no tax** — just the sum of line items in the tenant currency.

---

## 3. CLI commands (v0)

| Command | Emits / does | Layer |
|---|---|---|
| `lead:create --tenant t0 --customer "<name>"` | `LeadCreated` | Core seed |
| `lead:qualify --tenant t0 --lead <id>` | `LeadQualified` | Core seed |
| `proposal:start --tenant t0 --lead <id> --template <name>` | `ProposalDraftCreated`; creates draft work-area | Module |
| `proposal:add-item --tenant t0 --draft <id> --label "<l>" --amount <n>` | updates draft (**no event**) | Module |
| `proposal:set-scope --tenant t0 --draft <id> --text "<scope>"` | updates draft (**no event**) | Module |
| `proposal:show --tenant t0 --draft <id>` | prints the draft read-model | Module |
| `proposal:finalize --tenant t0 --draft <id>` | `ProposalDraftFinalized` + **single** `ProposalGenerated` (with `expectedValue`) | Module → Core |
| `proposal:discard --tenant t0 --draft <id>` | `ProposalDraftDiscarded` | Module |
| `events --tenant t0` | dumps the append-only log (**the evidence**) | Core |

> **Lead seed is minimal, not a CRM (review M2).** `lead:create` / `lead:qualify` exist only to satisfy the precondition that a draft starts from a *qualified* lead. No pipeline, scoring, or capture UX. This boundary is enforced by keeping them to two flat commands.

---

## 4. Build steps (lean, in order)

1. **Core event substrate** — `Event` shape with lineage; `event-log` append/read (JSONL, tenant-scoped); generic `projection` (replay). Test: append + replay reconstructs state; appends never mutate prior lines.
2. **Core seed commands** — `lead:create`, `lead:qualify` emitting Core events. Test: a draft cannot start from an unqualified lead (AC-1 negative).
3. **Proposal Generation module** — draft work-area + `proposal:start/add-item/set-scope/show`; milestone events. Test: edits emit no event (AC-4); start emits `ProposalDraftCreated` (AC-1).
4. **Finalize handoff** — `proposal:finalize` emits `ProposalDraftFinalized` + exactly one `ProposalGenerated` with `expectedValue`; draft becomes non-editable. Test: exactly one `ProposalGenerated` (AC-5, R1); `expectedValue` = sum of items (AC-3).
5. **Discard** — `proposal:discard` emits `ProposalDraftDiscarded`, no Core Proposal (AC-6).
6. **CLI wiring + `events` dump** — command dispatch via `parseArgs`; `events` prints the log.
7. **Evidence run + isolation test** — scripted end-to-end session (below); two-tenant isolation check (AC-9); full-log replay reconstructs state (AC-7).
8. **`.gitignore`** — add `data/` so no runtime/tenant data enters version control (no-PII rule).

---

## 5. The evidence we capture (the whole point)

A recorded end-to-end session, committed as a transcript (synthetic data only):

```
lead:create   t0 "ACME (mock)"        -> LeadCreated
lead:qualify  t0 <leadId>             -> LeadQualified
proposal:start t0 <leadId> standard   -> ProposalDraftCreated
proposal:add-item t0 <draftId> "Discovery" 1200
proposal:add-item t0 <draftId> "Build" 4800
proposal:finalize t0 <draftId>        -> ProposalDraftFinalized + ProposalGenerated(expectedValue=6000)
events t0                             -> append-only audit trail printed
```

This session demonstrates: tenant-scoped immutable events, the read-model draft (no event noise), the clean Module→Core handoff, and the `expectedValue` contract ready for Revenue Visibility. **That is the validation evidence** — concrete, auditable, replayable.

---

## 6. Acceptance-criteria → test mapping

| Spec 002 AC | Covered by |
|---|---|
| AC-1 (start from qualified lead; reject otherwise) | Step 2 + 3 tests |
| AC-3 (expected value = sum of items, no tax) | Step 4 test |
| AC-4 (edits emit no event) | Step 3 test |
| AC-5 (finalize → single ProposalGenerated) | Step 4 test (R1) |
| AC-6 (discard, no Core Proposal) | Step 5 test |
| AC-7 (auditability; replay reconstructs) | Step 1 + 7 tests |
| AC-8 (expectedValue contract for RV) | Step 4 (emits contract; consumption validated when Spec 001 is built) |
| AC-9 (tenant isolation) | Step 7 test |

---

## 7. Scope guardrails (do NOT build in v0)

- No CRM, pipeline, scoring (lead seed is two flat commands).
- No pricing engine, discounts, or tax (flat line items; `expectedValue` is a sum).
- No automated sending, e-signature, or contract generation.
- No AI drafting (future, bounded agent under policy).
- No orchestration / workflow engine (that is Phase 2; v0 is manual commands).
- No UI; no real client data / PII (templates are mock; `data/` is gitignored).
- No Revenue Visibility implementation here (Spec 001 is separate; v0 only emits the `expectedValue` contract).

---

## 8. Definition of done (v0)

- The evidence session above runs end to end and prints a coherent, append-only, tenant-scoped event log.
- All acceptance-criteria tests pass (`node --test`).
- Finalize emits exactly one `ProposalGenerated` carrying `expectedValue`.
- Two tenants show zero cross-leakage.
- `data/` is gitignored; no PII in the repo.

---

*Subordinate to [Spec 002](./spec.md), the [Constitution](../../memory/constitution.md), and [ADR-001](../../governance/decisions/ADR-001-defer-root-entity-selection.md). Implementation plan only — the build is the next step.*
