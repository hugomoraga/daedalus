# Spec File Conventions

> **Authority.** This document is the human-readable companion to [Spec 015 — Spec File Convention](../specs/015-spec-file-convention/spec.md). The spec is the binding contract; this file is the worked-example reference. If they ever conflict, the spec wins.

> **Purpose.** Specs in Daedalus (under `specs/NNN-*/`) carry their task breakdown in `tasks.md`. Theia (Spec 012) reads those files to report per-spec progress on its overview page. For that reporting to be accurate, every `tasks.md` must follow one canonical format. This file explains that format with examples.

---

## Why this exists

Pre-Spec-015, `tasks.md` files used two formats: the **canonical** markdown-checkbox form (`- [x] / - [ ]`), and the **legacy** emoji-table form (`| ✅ | / | ⏸ |`). Theia only counted checkboxes, so 11 of 15 specs reported `0 / 0` even when shipped. Two specs (003, 005) had no `tasks.md` at all.

Spec 015 fixes this by:

1. fixing one **canonical format** below;
2. teaching the parser to recognise the legacy form as a defensive fallback (only fires when no checkboxes are present);
3. shipping a linter that fails `npm test` when a new spec violates the format;
4. shipping a Theia widget that surfaces non-conforming specs;
5. migrating all 15 existing specs (Spec 015 §6 AC-5).

---

## The canonical format

Every `specs/NNN-*/tasks.md` follows this contract:

```markdown
# Tasks — <Title>

**Status:** <Shipped | Planning | Draft>
**Derives from:** [Spec NNN](./spec.md) + [Plan NNN](./plan.md) <vX.Y.Z>
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md)
**Version:** <tasks.md version>
**Last updated:** <YYYY-MM-DD>

> Forward note.

---

## 1. Reality check (verified, not assumed)
…

## 2. <Build phase A>

- [x] T-01: <description> (AC-N)
- [x] T-02: <description> (AC-M)
- [ ] T-03: <description> (AC-P)

## 3. <Build phase B>

- [ ] T-04: <description> (AC-Q)
…
```

### Binding rules

| # | Rule | Why |
|---|---|---|
| 1 | **One checkbox per task.** Each task is exactly one `- [x]` or `- [ ]` line. No nested checkboxes, no `\| ✅ \|` table cells, no inline `[x]` inside prose. | Theia counts one box per line; deviations break the count. |
| 2 | **Stable ID prefix.** Every checkbox carries a stable ID: `T-NN`, or module-prefixed (`OF-NN`, `IA-NN`, `J-NN`, `P-NN`, `R-NN`, …) when mirroring a multi-package spec. IDs are **never reused** within a spec, and a removed task's ID is **never reissued**. | ADRs, PR descriptions, and downstream specs reference task IDs; reissuing breaks traceability. |
| 3 | **Sections numbered.** `## N.` headers separate logical groups (build phases, milestones, evidence runs). Build status lives in the checkbox state, not in a separate column. | Lets the linter count tasks per phase if needed. |
| 4 | **Spec AC traceability.** Each task line references at least one spec acceptance criterion (`(AC-N)`) or a justification like `(shipped)`. | Every task must trace to a contract. |
| 5 | **No status tables.** Tables for metadata (links, AC mapping) may stay; the *status column* disappears — it is encoded in the checkbox. | A `Status` column is the legacy form; keeping it would re-introduce the drift. |
| 6 | **`tasks.md` is mandatory** for every spec that is not `Superseded`. Draft specs may have an empty task list but the file must exist. | Theia and the linter both expect the file. |

### Recognised spec statuses (for `**Status:**` line)

`Ratified` · `Draft` · `Blocked` · `Superseded` · `Planning` · `Shipped`.

Anything else parses as `Unknown` in Theia and fails the linter.

### Recognised tasks.md statuses

The `**Status:**` line at the top of `tasks.md` is free-form prose — the linter does not parse it. Only the `**Status:**` line in `spec.md` is structurally checked.

---

## Worked example — a shipped spec

```markdown
# Tasks — Core Value-Chain Completion

**Status:** v0 **shipped & green** (PR #14 — `012-core-value-chain-completion`)
**Derives from:** Spec 006 + Plan 006
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 1.0.0
**Last updated:** 2026-06-22

> The `/tasks` step for closing the Core value chain `Lead → Payment`. All v0 tasks shipped.

---

## 1. Reality check (verified, not assumed)

v0 is built and passing (`node --test` green; 88 tests).

---

## 2. v0 build (Phase 1) — DONE

- [x] T-01: Domain: `ProposalSubmitted` + `ProposalRejected` event types (AC-1)
- [x] T-02: Domain: `Project` aggregate (created/delivered/closed), state machine (AC-2, AC-3)
- [x] T-03: Domain: `Invoice` aggregate (issued/sent/paid/overdue), state machine (AC-4, AC-5)
- [x] T-04: Projections: `projectProposal`, `projectProject`, `projectInvoice` (AC-6)
- [x] T-05: Use case: `submitProposalUseCase` (idempotent) (AC-1)
…
```

## Worked example — a planning spec

```markdown
# Tasks — Workflow Engine

**Status:** Build **authorized** — [Spec 008](./spec.md) ratified (v0.2.0) and [ADR-006] accepted.
**Derives from:** Spec 008 + Plan 008
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 0.2.0
**Last updated:** 2026-06-22

> The `/tasks` step for the Workflow Engine. Build authorized — implementation begins in branch `024-workflow-engine-scaffold`.

---

## 2. v0 build (Phase 2) — NOT STARTED

- [ ] T-01: `packages/workflow-engine/` scaffolding (AC-10) (pending)
- [ ] T-02: `domain/workflow.ts` — Workflow artifact type (AC-1) (pending)
- [ ] T-03: `domain/instance.ts` — Instance state (AC-6) (pending)
…
```

## Worked example — a Draft spec (empty checklist)

```markdown
# Tasks — Opportunity Discovery

**Status:** Draft (planning; build not authorized)
**Derives from:** [Spec 003](./spec.md) + [Plan 003](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> Migrated to canonical format. No code exists yet (`packages/opportunity-discovery/` does not exist).

---

## 1. Reality check

- **v0 status: planning.** No code yet.

---

## 2. v0 build — Draft

*(none yet — see Spec 003 spec.md §6 for the candidate task list)*
```

The Draft-status exemption applies: a `tasks.md` with zero checkboxes is allowed only when `spec.md` `**Status:**` is `Draft`.

---

## Edge cases

### Multi-package specs

Use module-prefixed IDs to keep traceability clear:

- Spec 014 (inbound agent + offering module) uses `OF-NN` for the offering package and `IA-NN` for the agent package. Both prefixes live in the **same** `tasks.md`; the ID prefix is the only separator.

### Intentional non-tasks

A task that documents what the project is **not** doing should still be a checkbox — but unchecked and tagged `(intentional non-task)`:

```markdown
- [ ] J-13: **Do NOT create `config/tenants/tenant-0.jurisdiction.ts` in this phase.** (intentional non-task)
```

The parser counts it as a `- [ ]`, which is correct: the task is "do not do this thing", and it has not been "done" (it is permanently open). The linter is satisfied because the file has checkboxes.

### Tasks that depend on later phases

Mark them unchecked and tag the blocker inline:

```markdown
- [ ] T-28: Replace no-op `PolicyDecisionPort` with the real policy engine — Phase 3 not started (blocked)
```

### Mixed shipped + planning in the same file

Use section headers to separate. The parser doesn't care about sections; it counts every `- [x]` / `- [ ]` line. Section headers are for humans.

---

## How the parser and linter use this format

### Parser (`tools/theia/src/parser/completion.ts`)

Counts every `- [x]` / `- [ ]` line via the regex `/^\s*-\s+\[(x|X| )\](?:\s|$)/gm`. A `- [X]` (uppercase) also counts as done. Indented checkboxes count too.

Defensive back-compat: if a `tasks.md` has **zero** checkboxes, the parser falls back to counting `✅` and `⏸` / `⛔` cells in tables (one cell per task). This exists only to keep legacy files honest during the migration window; new specs MUST NOT use the legacy form.

### Linter (`tools/scripts/check-spec-conventions.mjs`)

Fails `npm test` if:

- `tasks.md` is missing (for non-Superseded specs).
- `tasks.md` has zero checkboxes (for non-Draft specs).
- `**Status:**` line in `spec.md` is missing or starts with an unrecognised word.
- (warns only) `**Version:**` or `**Last updated:**` missing in `spec.md`; task IDs that don't match the conventional prefix pattern.

Exit codes: `0` clean, `1` fail, `2` warn only.

---

## Migration recipe (for old specs)

The mechanical transformation:

```diff
- | ID | Task | Spec AC | Status |
- |---|---|---|---|
- | T-01 | React to `ProposalGenerated`; emit derived `RevenueEstimateCreated` | AC-2 | ✅ |
- | T-02 | Idempotency: skip if estimate already exists | AC-3 | ✅ |
+ - [x] T-01: React to `ProposalGenerated`; emit derived `RevenueEstimateCreated` (AC-2)
+ - [x] T-02: Idempotency: skip if estimate already exists (AC-3)
```

Status column disappears. The cells become one bullet line per task. Other columns (Spec AC, Produces, etc.) become inline annotations.

Tables that are purely metadata (links, AC mapping, etc.) may stay; only the **Status** column is removed.

---

## Cross-references

- [Spec 015 — Spec File Convention](../specs/015-spec-file-convention/spec.md) — the binding contract.
- [Spec 015 Plan](../specs/015-spec-file-convention/plan.md) — the parser + linter + widget design.
- [Spec 012 — Theia](../specs/012-theia/spec.md) §4 — what Theia reads.
- `tools/theia/src/parser/completion.ts` — the parser.
- `tools/scripts/check-spec-conventions.mjs` — the linter.
- `tools/theia/src/views/overview.ts` — the drift widget.