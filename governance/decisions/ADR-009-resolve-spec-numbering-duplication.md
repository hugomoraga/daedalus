# ADR-009 — Resolve spec numbering duplication (008 and 009 pairs)

**Status:** Accepted
**Date:** 2026-06-22
**Deciders:** Stewards
**Trigger:** Closing the "known naming oddity" called out in [Spec 008 — Workflow Engine §0](../specs/008-workflow-engine/spec.md) (and implicitly in [Spec 009 — Policy Engine](../specs/009-policy-engine/spec.md)). Two pairs of specs shared a `NNN-` prefix because both existed as drafts concurrently and one was merged first.
**Related:** [Constitution](../../memory/constitution.md) (Principle 8 — *Spec-Driven Development*), [AGENTS.md](../../AGENTS.md), [ADR-003](./ADR-003-modular-monorepo.md) (modular monorepo layout), [ADR-008](./ADR-008-worktree-per-session.md) (worktree-per-session for multi-agent).

---

## Context

Two pairs of specs in `specs/` shared a numeric prefix:

| Prefix | Pair |
|---|---|
| `008-` | `008-jurisdiction-model` ↔ `008-workflow-engine` |
| `009-` | `009-policy-engine` ↔ `009-social-to-opportunity-mvp` |

The "older" member of each pair had been merged first, winning the prefix naturally. The newer member documented the duplication as a *known naming oddity* in its own `spec.md` and continued under the same prefix. This worked but created **two real problems**:

1. **Cross-references become ambiguous.** A link to "Spec 008" has two valid referents. Documentation that says "see Spec 008" is no longer self-resolving.
2. **Roadmap and tooling ambiguity.** Any tool that walks `specs/*/` and assumes one-to-one mapping between N and spec (the natural assumption for a numbered spec system) gets confused.

Today (2026-06-22), 14 specs exist in `specs/`. Two pairs duplicate numbers. The remaining 10 are clean.

## Decision

Renumber the **newer member** of each pair. The renumbering is purely a directory rename + reference update; no spec content changes.

| Old | New | Rationale |
|---|---|---|
| `008-jurisdiction-model` | `013-jurisdiction-model` | The newer 008 (after `008-workflow-engine` shipped). Appends to the end of the registry (13 follows 12). |
| `009-social-to-opportunity-mvp` | `014-social-to-opportunity-mvp` | The newer 009 (after `009-policy-engine` shipped). Appends to the end of the registry (14 follows 13). |

The older members (`008-workflow-engine` and `009-policy-engine`) keep their prefix — they won the race to it naturally, and they have hundreds of references; renumbering them would be a much larger change for no semantic gain.

### Why not "merge the duplicated numbers"?

Tempting (make `008-workflow-engine` and `008-jurisdiction-model` both stay 008 in different scopes), but the spec system has only one scope for numeric prefixes. Two members with the same N would force a different axis (e.g. a category letter) which would also require updating every reference. Pure append is simpler and matches the existing convention.

### Why append and not interleave?

The renumbered specs (013 and 014) describe capabilities that were drafted *after* the older 12 specs. Appending at the end preserves the chronological order without renumbering any spec that was already referenced. Lower blast radius.

## Migration

Pure mechanical change, no behavior modification:

1. `git mv specs/008-jurisdiction-model specs/013-jurisdiction-model`
2. `git mv specs/009-social-to-opportunity-mvp specs/014-social-to-opportunity-mvp`
3. Update references in:
   - 9 markdown files (specs cross-references + `docs/identity.md` + `docs/repository-structure.md`)
4. Update the comment in `docs/repository-structure.md` that previously flagged the duplication as a "known naming oddity".

## Consequences

### Positive

- **One-to-one N-to-spec mapping restored.** "Spec 008" unambiguously means Workflow Engine. The "known naming oddity" notation is removed from `013-jurisdiction-model/spec.md`.
- **No spec content changed.** The renumbering is a directory-level operation only. All spec text, plans, and tasks are byte-identical to before.
- **Reference count was small.** Only 11 files referenced the duplicated paths (most via cross-spec links; `009-social-to-opportunity-mvp` had zero external references).

### Negative / risks

- **git history fragmentation.** The renamed directories have no shared history with their new N. `git log specs/013-jurisdiction-model/` shows the full history because git tracks the rename; no information is lost.
- **External references.** Any out-of-repo references (e.g. ADRs that mention the old paths) were updated in this same PR. PR description lists the exact files.
- **Theia fixtures.** Theia is in flight (PRs 60-70+); its fixtures may reference spec paths. Verified that no Theia file currently references the duplicated paths.

## Acceptance (met)

- `git mv` complete for both directories; commit + push to `072-renumber-008-009`; PR opened.
- `grep -r "008-jurisdiction-model\|009-social-to-opportunity-mvp"` over the entire repo (excluding `node_modules` and `.data/`) returns 0 hits.
- `docs/repository-structure.md` reflects the new numbers with a `# was 008-...; renumbered per ADR-009` annotation so future readers can trace the move.
- This ADR (009) is accepted.

---

*Subordinate to the [Constitution](../../memory/constitution.md). Operational governance; no canonical artifacts changed beyond the directory renames and the matching reference updates.*
