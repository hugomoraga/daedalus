# governance/decisions/

Architecture Decision Records (ADRs).

Every significant architectural choice is recorded here, version-controlled, with its context, the decision, and its consequences. Changing the repository's top-level structure requires an ADR.

ADRs make the *reasoning* behind the system auditable, not just its current state — satisfying *Auditability by Default* (Principle 4) for architecture itself.

## Amending an ADR

ADRs are append-only-by-default. When the decision itself needs to change (not just be superseded), edit the existing file:

1. Update the `Status:` line to `Accepted; Amended <date> — <one-line summary>` (or `Proposed`, `Superseded by ADR-NNN`, etc.).
2. Apply the change to the relevant section(s) inline.
3. Append a clearly delimited `## Amendment — <date>` section at the end with:
   - **What changed** (which sections).
   - **Why** (the trigger, the evidence, the prior approach's failure mode).
   - **Tradeoffs accepted.**
   - **Migration** (what happens to in-flight artifacts; usually "none, only new ones go to the new path").
   - **Acceptance** checklist (tests pass, audit findings, no canon change unless explicit).
4. Commit the amendment under a `docs(governance): amend ADR-NNN — …` message; open a PR like any other change.

Precedent: [ADR-008 §Amendment — 2026-06-22 (in-repo worktrees)](./ADR-008-worktree-per-session.md#amendment--2026-06-22-in-repo-worktrees), merged via PR #86.

Supersession is the alternative to amendment: if a decision is **replaced** rather than **revised**, write a new ADR that states `Supersedes: ADR-NNN §X` and add a one-line note at the top of the superseded ADR pointing to the new one. ADR-008's amendment left the original text editable inline because the change was a revision (location detail), not a replacement (the worktree-per-session principle stands).

*Empty in Phase 0. The foundational documents in [`docs/`](../../docs/) and the [Constitution](../../memory/constitution.md) are the founding decisions; subsequent ones accrue here as ADRs.*
