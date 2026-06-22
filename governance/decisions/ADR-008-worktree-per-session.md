# ADR-008 — Worktree-per-session for parallel agents + branch-ownership protocol

**Status:** Accepted; Amended 2026-06-22 — §1 worktree location moved from sibling (`../daedalus-<slug>/`) to in-repo (`.worktrees/<slug>/`). See [Amendment](#amendment--2026-06-22-in-repo-worktrees) below.
**Date:** 2026-06-22 (amended same day)
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
# Setup (one time per session, from the main checkout)
git worktree add .worktrees/atlas   -b 050-atlas-spec-ratify   main
git worktree add .worktrees/spec004 -b 052-spec004-impl        main
git worktree add .worktrees/theia   -b 058-spec012-impl-pr1    main
```

- Each worktree has its **own** working tree, **own** `.data/`, **own** `node_modules/` (via npm workspaces).
- A `git checkout` in one worktree does **not** touch the others. Sessions cannot wipe each other.
- `.git/worktrees/<name>/` tracks the binding; cleanup is `git worktree remove .worktrees/<slug>`. The `.worktrees/` directory itself is gitignored — it is a parent for session checkouts, not a tracked folder.

### 2. **Branch ownership is one-session-at-a-time**

The AGENTS.md rule is sharpened:

> **One agent per branch per worktree. A branch is checked out in at most one worktree at a time.**

- A session may **read** another session's branch via `git show <branch>:<path>` or via PR review, but it does **not** check it out.
- **Enforcement is convention + bootstrap, not a hook.** `tools/scripts/new-session.sh` refuses to bind a branch that is already checked out in another worktree (it greps `git worktree list --porcelain`). Git itself prevents two worktrees from checking out the same branch. A pre-commit hook that re-checks `git worktree list` is intentionally **not** shipped — the rule is social, not tool-enforced; documenting it is enough.

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

### 5. **Coordination: `git worktree list --porcelain` is the source of truth**

There is **no separate coordination log**. Branch ↔ worktree bookkeeping already exists in git and is queryable:

```bash
$ git worktree list --porcelain
worktree /Users/hu/daedalus-atlas
HEAD abc123…
branch refs/heads/056-atlas-path-cleanup

worktree /Users/hu/daedalus-spec004
HEAD def456…
branch refs/heads/052-spec004-impl
```

A new session runs `git worktree list --porcelain` to see which branches are bound to which worktrees before picking an `NNN`. **This is the only coordination mechanism.** No `.data/agents/<session-id>/branch.json` is written or read — that location was considered and rejected because `.data/` is per-worktree (§6), so a per-worktree log cannot communicate *across* sessions, which is precisely what coordination needs.

`tools/scripts/new-session.sh` already uses `git worktree list --porcelain` to refuse clobbering an existing branch binding; no new code is required.

### 6. **`.data/` is per-worktree**

Each worktree has its own `.data/` (gitignored). Tests inside one worktree do not see tests running in another. Production deployments still share `.data/` because they share the same machine, not because of the worktree.

### 7. **Bootstrap script lives in `tools/scripts/new-session.sh`**

A single shell script does the worktree setup + initial `npm install`:

```bash
tools/scripts/new-session.sh 056 atlas-path-cleanup
# → creates worktree .worktrees/atlas-path-cleanup on branch 056-atlas-path-cleanup
# → prints "Next steps" instructions
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
- A one-line script `tools/scripts/new-session.sh` (or alias) that does `git worktree add .worktrees/<slug> -b <branch> main` and `cd`s into it.
- Each new session calls this script before starting work.
- Existing branches (without a worktree) remain valid; the user can `git worktree add .worktrees/<slug> <existing-branch>` to bind them when convenient.

**CI / scripts:**
- `npm install` in each worktree (npm workspaces handles symlinks across worktrees, but a fresh `npm install` per worktree is the safe default).
- The `npm test` and lint scripts are unchanged; they operate on the working tree they're invoked from.

**Cleanup on session close:**
- `git worktree remove .worktrees/<slug>` once the PR is merged (or when the session is abandoned).
- Stale worktrees are listed by `git worktree list` and pruned periodically. The `.worktrees/` directory itself is gitignored and never enters version control, so a `git worktree remove` is the only cleanup needed.

---

## Consequences

### Positive
- **No work loss from auto-branch-switch.** A `git checkout` in one worktree cannot touch another's working tree. The two failure modes observed on 2026-06-22 become structurally impossible.
- **True parallel sessions.** Two sessions can run *simultaneously* on *different branches* in *different worktrees* without coordination beyond the branch number.
- **Better debugging.** `git worktree list --porcelain` shows exactly which session is on which branch. No parallel log to maintain.
- **No canon change.** Operational, not architectural.

### Negative / risks
- **Disk usage.** Each worktree holds a copy of the working tree + `node_modules/`. For this repo (small), the cost is negligible. For larger repos, worktrees double the on-disk size. **Mitigation:** prune stale worktrees after merge.
- **Setup overhead.** One extra command per session. **Mitigation:** the `tools/scripts/new-session.sh` script (one line).
- **`.data/` divergence.** Each worktree's tests see only that worktree's `.data/`. Already true for `mkdtemp`-based tests; this just makes it explicit. **Mitigation:** none needed.
- **No WIP-commit hook is shipped.** Tempting to add a `pre-checkout` hook that auto-commits WIP — but git's hook fires *after* the worktree update (§4), so it cannot save uncommitted edits. The worktree is the structural fix; no automated save mechanism is provided. **Mitigation:** none needed — commit or stash before any in-worktree checkout.
- **Cross-worktree reads.** To read another session's work, use `git show <branch>:<path>` or PR review (not `git checkout`). This is a small ceremony, not a real cost.

---

## Acceptance (met when)

- [x] `tools/scripts/new-session.sh` exists, is executable, refuses to clobber existing worktrees/branches.
- [x] AGENTS.md §"Git & collaboration protocol" is updated to reference this ADR and to require the worktree-per-session pattern.
- [x] A short doc note in `docs/agent-orchestration.md` (new file, ~30 lines) explains the workflow with a worked example.
- [x] No `pre-checkout` hook (proven infeasible per §4 — git fires it post-update).
- [x] No code, no spec, no new event types — this ADR is operational governance only.

### Post-ratification follow-ups (closed in `070-adr008-review-fixes`)

- [x] **Decision 5 contradiction resolved.** The original §5 proposed a `.data/agents/<session-id>/branch.json` log, which is structurally broken because `.data/` is per-worktree (§6) — a per-worktree log cannot communicate across sessions. Replaced with `git worktree list --porcelain` (git's built-in bookkeeping) as the coordination mechanism. `tools/scripts/new-session.sh` already uses this for collision detection.
- [x] **Stale `pre-checkout` reference removed from Consequences.** The original draft mentioned a "pre-checkout hook that auto-commits"; Decision 4 explicitly ships no such hook. Rewrite clarifies that the worktree is the structural fix and no automated save is provided.
- [x] **Branch-ownership rule clarified as convention-enforced** (Decision 2 now states: enforced by `tools/scripts/new-session.sh` collision check + git's own per-branch worktree invariant, **not** by a pre-commit hook — the rule is social, not tool-enforced).

---

## Amendment — 2026-06-22 (in-repo worktrees)

**What changed.** §1, §7, and the *Migration* section now specify that worktrees live **inside the main repo** at `.worktrees/<slug>/` instead of as siblings at `../daedalus-<slug>/`. The bootstrap script `tools/scripts/new-session.sh` was updated; `.gitignore` now excludes `.worktrees/`.

**Why.**
1. **Sibling worktrees polluted the user's `Proyectos/` folder.** Every new session spawned a `daedalus-<slug>` directory next to the main repo, and pruning fell on the user. With several parallel sessions, the parent folder accumulates fast and obscures which directories are real projects vs transient session artifacts.
2. **Bootstrap asked for permission unnecessarily.** Because the sibling path crossed into "the user's filesystem outside the repo", agents bootstrapping a new worktree defaulted to confirming with the user before running the script. An in-repo, gitignored path is structurally self-contained — no filesystem boundary crossed — so the bootstrap becomes a one-line, no-ask operation.
3. **Precedent.** Large repos (Linux kernel, git itself, GitHub monorepo tooling) keep worktrees under a gitignored subdirectory of the main checkout precisely for this reason.

**Tradeoffs accepted.**
- Tools that walk the repo tree (`find`, lint, snapshot tests, anything that lists files) must skip `.worktrees/`. The audit accompanying this amendment verified that **no code path walks from the repo root**: every existing walker is scoped to a specific subdirectory (`packages/core/src`, `config/rulesets`, `specs`, `governance/decisions`, `tools/theia/src`, etc.). All of those are siblings of `.worktrees/`, not parents of it, so none can descend into a worktree. **No walker code changes were required.**
- The main checkout is co-located with worktrees; the convention is "the root of the repo is the main checkout, anything under `.worktrees/<slug>/` is a session." `git status` from the root shows only the main checkout's working tree (worktrees have their own status).
- A worktree path that lives inside the same physical repo can confuse newcomers. Mitigation: the bootstrap script prints the absolute worktree path on success, and `AGENTS.md` is the entry point for any agent reading the protocol.

**Migration of existing worktrees.** None. Sibling worktrees already on disk (e.g. `../daedalus-atlas-path-cleanup`) stay where they are and are pruned through the existing `git worktree remove <abs-path>` flow when their PR merges. Only **new** worktrees go to `.worktrees/<slug>/`. There is no script to move old worktrees; the cost is negligible (each is one branch, will be deleted at PR merge), and the alternative — moving worktrees mid-session — risks losing uncommitted edits.

**Bootstrap script change.** `tools/scripts/new-session.sh` replaces

```bash
WORKTREE_PATH="${WORKTREE_PARENT}/${REPO_NAME}-${SLUG}"
```

with

```bash
WORKTREE_PATH="${REPO_ROOT}/.worktrees/${SLUG}"
```

The unused `REPO_NAME` and `WORKTREE_PARENT` variables were removed.

**.gitignore.** Added a section excluding `.worktrees/` (with a reference back to this ADR), placed next to the existing `.data/` rule because both serve the same purpose: per-session, never-tracked state.

**Acceptance (this amendment).**
- [x] §1, §7, and *Migration* updated to reference `.worktrees/<slug>/`.
- [x] `tools/scripts/new-session.sh` creates worktrees at `.worktrees/<slug>/` and refuses to clobber.
- [x] `.gitignore` excludes `.worktrees/`.
- [x] Repo-tree walkers audited (none walk from root; no code changes required — see "Tradeoffs accepted" above).
- [x] `npm test` green from the main checkout with `.worktrees/` present and empty.
- [x] No change to Constitution, Technical Principles, or Identity — this amendment is operational governance only, same as the original.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [AGENTS.md](../../AGENTS.md). Operational governance for multi-agent orchestration; no canonical artifacts changed.*
