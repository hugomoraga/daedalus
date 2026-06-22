# Agent orchestration

How multiple AI-agent sessions work together on Daedalus without stepping on each other. Subordinate to [AGENTS.md](../AGENTS.md) and [ADR-008](../governance/decisions/ADR-008-worktree-per-session.md).

## TL;DR

**Every agent session runs in its own `git worktree`.** One branch per session. PRs coordinate between sessions. No session can wipe another's uncommitted edits because the working trees are physically separate.

## Why worktrees, not shared working trees

Before [ADR-008](../governance/decisions/ADR-008-worktree-per-session.md), every session shared one physical working tree. The branch-level protocol (\"one agent per branch\") was followed, but the working-tree level was unprotected. An auto-branch-switch + `git reset` could — and did — wipe uncommitted edits from any session. Two work-loss incidents in one day (2026-06-22) forced the change.

Worktrees fix the structural problem: a `git checkout` in one worktree cannot touch another's working tree. Each session's `.data/`, `node_modules/`, and uncommitted edits are physically isolated.

## Session lifecycle (worked example)

```bash
# === Session A: ATLAS ratification ===
# (start the session, the agent's first move)
tools/scripts/new-session.sh 050 atlas-spec-ratify
#   → creates /Users/hu/daedalus-atlas-spec-ratify on branch 050-atlas-spec-ratify
cd /Users/hu/daedalus-atlas-spec-ratify
npm install   # workspace symlinks re-resolve from the new working tree

# (work happens in this worktree, isolated from all other sessions)
# ... edit specs/007-atlas-ui/spec.md ...
git add specs/007-atlas-ui/spec.md
git commit -m "Ratify Spec 007 — ATLAS v1.0"
git push -u origin 050-atlas-spec-ratify
gh pr create --base main --head 050-atlas-spec-ratify --title "..."
# (PR is the async handoff; another session may review, but no other session
#  checks out this branch in this worktree)

# === Session B: Spec 004 impl (parallel, isolated) ===
tools/scripts/new-session.sh 052 spec004-impl
# → creates /Users/hu/daedalus-spec004-impl on branch 052-spec004-impl
cd /Users/hu/daedalus-spec004-impl
npm install
# (independent work; session A's worktree is untouched)

# === Session A: cleanup after PR merge ===
# (when 050 merges, session A's worktree is no longer needed)
cd /Users/hu/daedalus-atlas-spec-ratify
git worktree remove /Users/hu/daedalus-atlas-spec-ratify
# → done
```

## Conventions

- **One branch per worktree.** Two sessions never share a branch in two worktrees — one of them is the owner; the other reads via `git show <branch>:<path>` or PR review.
- **`.data/` is per-worktree.** Tests in worktree A do not see worktree B's state. Production deploys share `.data/` only because they share the same machine, not because of the worktree.
- **Branch naming** keeps the `NNN-short-slug` convention; an optional `-<agent-tag>` suffix (e.g. `-claude`, `-opencode`) records provenance when useful.
- **Before any in-worktree checkout** (rare — usually only `git show` is needed), commit or stash first. Git's `pre-checkout` hook fires *after* the worktree update and cannot prevent loss; this was verified empirically on git 2.53.

## What the protocol does NOT cover

- **Coordination of shared files** (e.g. `package.json`, `tools/`). If two sessions need to touch the same file, one opens first; the other rebases after.
- **Branch number allocation.** Sessions pick an unused `NNN` from `git log main --oneline` (the highest N + 1). Coordination is via `git worktree list --porcelain` (per [ADR-008 §5](../governance/decisions/ADR-008-worktree-per-session.md)) — that is the source of truth for which branches are bound to which worktrees. There is no separate advisory log; branch-number collisions are caught at PR-review time.
- **Cross-worktree test runs.** Tests run in the worktree they're invoked from. There is no shared test orchestration between sessions; each worktree is independent.

## Related

- [ADR-008 — Worktree-per-session](../governance/decisions/ADR-008-worktree-per-session.md) — the decision and rationale.
- [AGENTS.md §Git & collaboration protocol](../AGENTS.md) — the binding rules.
- [tools/scripts/new-session.sh](../tools/scripts/new-session.sh) — the bootstrap.
