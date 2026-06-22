# ADR-008 — Worktree-per-session for parallel agents + branch-ownership protocol

**Status:** Proposed
**Date:** 2026-06-22
**Deciders:** Stewards
**Trigger:** Two work-loss incidents in a single session (2026-06-22): a Spec 007 ratification commit was nearly lost to a `git reset` after an auto-branch-switch; a path-cleanup set of uncommitted edits was wiped by the same pattern.
**Related:** [AGENTS.md](../../AGENTS.md), [Constitution](../../memory/constitution.md) (Principle 4 — *Auditability by Default*), [ADR-003](./ADR-003-modular-monorepo.md) (workspace layout), [ADR-004](./ADR-004-export-discipline-and-lineage.md) (commit-as-contract), [ADR-007](./ADR-007-theia-as-tools-directory.md) (recent parallel-session precedent).

---

## Context

The Daedalus project now runs **multiple AI agents in parallel**, each driving a different capability:

| Session | Recent work (PRs in 2026-06-22) |
|---|---|
| **ATLAS session** (this one) | #51, #53, #54, #56, #58, #60 — Spec 007 ratification, Spec 011 spec+impl, ATLAS T-20..T-22, Compliance panel, path cleanup |
| **Spec 004 / Tax & Compliance session** | #52, #55 — Spec 004 ratification + Module implementation |
| **Spec 012 / Theia session** | #57, #59, in flight — Spec 012 ratification, scaffold |
| **UI session** (founder, out-of-band) | ad-hoc, not yet PR-tracked |

The AGENTS.md protocol says *"one agent per branch at a time. Coordinate via PRs, never edit the same branch concurrently."* The protocol holds at the **branch** level — each PR is one branch, one session. It does **not** hold at the **working-tree** level: every session shares the same physical `.git/` working tree, the same branch pointer, and the same `.data/` directory.

### Observed failure mode (twice in one session)

1. Session A opens branch `NNN-foo`, makes uncommitted edits.
2. A coordination mechanism (the user's external launcher / an opencode hook / an autosave cycle) **switches the branch pointer** to a branch owned by session B.
3. A `git reset HEAD` (often paired with the switch) **wipes session A's uncommitted changes** from the working tree.
4. Session A's work is recoverable only via `git fsck --lost-found` (if it was committed) or **lost entirely** (if uncommitted).

In the second incident, session A re-did the work; in the first, session A recovered the commit from reflog. Both are fragile.

### What the protocol does NOT cover today

- **Physical isolation**: any session can `git checkout` another session's branch and overwrite the working tree.
- **Working-tree contention**: edits to `package.json`, `tools/`, `specs/`, etc. by one session can be clobbered by another.
- **Auto-checkout hooks**: the auto-branch-switch happens *before* the user (or the agent) knows about it; no `pre-checkout` hook can stop it once it fires.
- **`.data/` shared state**: tests in two sessions can collide on `.data/tenants/...` writes (less common since tests use `mkdtemp`, but possible).

The cost of the status quo is **lost work + redo cycles** in the very workflow that is supposed to ship faster.

---

## Decision

### 1. **One git worktree per session**

Every agent session runs in its **own** `git worktree` — a separate physical checkout bound to one branch.

```bash
# Setup (one time per session)
git worktree add ../daedalus-atlas   -b 050-atlas-spec-ratify   main
git worktree add ../daedalus-spec004 -b 052-spec004-impl        main
git worktree add ../daedalus-theia   -b 058-spec012-impl-pr1    main
```

- Each worktree has its **own** working tree, **own** `.data/`, **own** `node_modules/` (via npm workspaces).
- A `git checkout` in one worktree does **not** touch the others. Sessions cannot wipe each other.
- `.git/worktrees/<name>/` tracks the binding; cleanup is `git worktree remove`.

### 2. **Branch ownership is one-session-at-a-time**

The AGENTS.md rule is sharpened:

> **One agent per branch per worktree. A branch is checked out in at most one worktree at a time.**

- A session may **read** another session's branch via `git show <branch>:<path>` or via PR review, but it does **not** check it out.
- The coordination log (`.data/agents/<session-id>/branch.json`, see §5) records who owns which branch; opening a new session picks an unused N.

### 3. **Branch naming carries the session id (optional but recommended)**

When in doubt about provenance, suffix the branch with a session tag:

```
NNN-<slug>-<agent-tag>
```

Examples: `050-atlas-spec-ratify-claude`, `052-spec004-impl-claude`. The tag is informational, not enforced. Existing branches without the tag remain valid.

### 4. **No `pre-checkout` hook — git's timing makes it unreliable for "save before"**

Investigated during this ADR's drafting: git's `pre-checkout` hook fires **after** the worktree has been updated (`git help hooks` is explicit: *"after having updated the worktree"*). It cannot prevent loss of uncommitted edits — by the time it runs, the working tree is already in the new branch's state.

The only hooks that run early enough are per-CLI tools or the user's own discipline. We adopt the latter: **before any checkout, commit or stash.** No automated hook is shipped.

This was deliberately cut from the ADR after empirical verification on git 2.53. The worktree is the structural fix; no hook can substitute.

### 5. **Coordination log (`.data/agents/<session-id>/branch.json`)**

Each session writes a tiny JSON file declaring itself:

```json
{
  "sessionId": "atlas-claude-2026-06-22-pt2",
  "branch": "056-atlas-path-cleanup",
  "worktree": "/Users/hu/daedalus-atlas",
  "openedAt": "2026-06-22T08:30:00.000Z",
  "capability": "ATLAS path cleanup"
}
```

A new session reads `.data/agents/*/branch.json` to see what's active before picking an N. The log is **advisory**, not enforced; the worktree is the structural enforcement.

### 6. **`.data/` is per-worktree**

Each worktree has its own `.data/` (gitignored). Tests inside one worktree do not see tests running in another. Production deployments still share `.data/` because they share the same machine, not because of the worktree.

### 7. **Bootstrap script lives in `tools/scripts/new-session.sh`**

A single shell script does the worktree setup + initial `npm install`:

```bash
tools/scripts/new-session.sh 056 atlas-path-cleanup
# → creates worktree ../daedalus-atlas-path-cleanup on branch 056-atlas-path-cleanup
# → prints "Next steps" instructions
# → exits 0 on success, non-zero with explanation on conflict
```

It refuses to clobber an existing worktree or branch (uses `git worktree list --porcelain` to detect collisions). The script is the **operational** counterpart of the ADR's structural decision.

### 8. **No canon amendments**

This ADR does **not** amend the Constitution, Technical Principles, or Identity. It is **operational governance**: how agents work, not what they build.

---

## Alternatives considered

### A. Auto-WIP-commit on every checkout (no worktrees)
- **Pros:** Trivial to implement (one hook). No session setup change.
- **Cons:** WIP commits pollute the branch; sessions can still trash each other's **same-branch** work; the working tree is still shared so file-level races persist. **Rejected: doesn't solve same-branch contention.**

### B. Coordinator script + lock file
- **Pros:** Explicit, debuggable.
- **Cons:** Lock files have race conditions; the coordinator becomes a single point of failure that must run before every agent action; sessions still share the working tree. **Rejected: lock files can't undo an auto-branch-switch that already happened.**

### C. Per-session physical directories (manual equivalent of worktrees)
- **Pros:** Same isolation as worktrees; zero tooling change.
- **Cons:** Easy to forget; no git-side bookkeeping; sessions can `cd` into each other's dirs and lose context. **Rejected: worktrees give the same isolation with built-in bookkeeping (`git worktree list`).**

### D. Status quo (one working tree, branch-protocol discipline)
- **Pros:** No change.
- **Cons:** We've now lost work twice in one session under this regime. The protocol works at the *branch* level but fails at the *working-tree* level. **Rejected: the cost of lost work exceeds the cost of one worktree per session.**

---

## Migration

**Immediate (no ceremony):**
- A one-line script `tools/scripts/new-session.sh` (or alias) that does `git worktree add ../daedalus-<name> -b <branch> main` and `cd`s into it.
- Each new session calls this script before starting work.
- Existing branches (without a worktree) remain valid; the user can `git worktree add <path> <existing-branch>` to bind them when convenient.

**CI / scripts:**
- `npm install` in each worktree (npm workspaces handles symlinks across worktrees, but a fresh `npm install` per worktree is the safe default).
- The `npm test` and lint scripts are unchanged; they operate on the working tree they're invoked from.

**Cleanup on session close:**
- `git worktree remove <path>` once the PR is merged (or when the session is abandoned).
- Stale worktrees are listed by `git worktree list` and pruned periodically.

---

## Consequences

### Positive
- **No work loss from auto-branch-switch.** A `git checkout` in one worktree cannot touch another's working tree. The two failure modes observed on 2026-06-22 become structurally impossible.
- **True parallel sessions.** Two sessions can run *simultaneously* on *different branches* in *different worktrees* without coordination beyond the branch number.
- **Better debugging.** `git worktree list` shows exactly which session is on which branch. The `.data/agents/<id>/branch.json` log makes intent explicit.
- **No canon change.** Operational, not architectural.

### Negative / risks
- **Disk usage.** Each worktree holds a copy of the working tree + `node_modules/`. For this repo (small), the cost is negligible. For larger repos, worktrees double the on-disk size. **Mitigation:** prune stale worktrees after merge.
- **Setup overhead.** One extra command per session. **Mitigation:** the `tools/scripts/new-session.sh` script (one line).
- **`.data/` divergence.** Each worktree's tests see only that worktree's `.data/`. Already true for `mkdtemp`-based tests; this just makes it explicit. **Mitigation:** none needed.
- **WIP commit cleanup burden.** The pre-checkout hook auto-commits, which can litter a branch with WIP commits if used heavily. **Mitigation:** the worktree makes this hook rarely needed; the hook is the last-resort fallback, not the primary mechanism.
- **Cross-worktree reads.** To read another session's work, use `git show <branch>:<path>` or PR review (not `git checkout`). This is a small ceremony, not a real cost.

---

## Acceptance (met when)

- [x] `tools/scripts/new-session.sh` exists, is executable, refuses to clobber existing worktrees/branches.
- [ ] AGENTS.md §"Git & collaboration protocol" is updated to reference this ADR and to require the worktree-per-session pattern.
- [ ] A short doc note in `docs/agent-orchestration.md` (new file, ~30 lines) explains the workflow with a worked example.
- [ ] No `pre-checkout` hook (proven infeasible per §4 — git fires it post-update).
- [ ] No code, no spec, no new event types — this ADR is operational governance only.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [AGENTS.md](../../AGENTS.md). Operational governance for multi-agent orchestration; no canonical artifacts changed.*
