#!/usr/bin/env bash
# tools/scripts/new-session.sh — bootstrap script for a new agent session.
#
# Creates a git worktree bound to a new branch, isolated from any other
# session's working tree. The session's edits, `.data/`, and `node_modules/`
# are physically separate from other sessions (different branch → different
# files in `.worktrees/<slug>/`). The main checkout (the one on `main`) is
# unaffected.
#
# Per ADR-008 (amended 2026-06-22), worktrees live at `.worktrees/<slug>/`
# inside the repo (gitignored), not as siblings at `../daedalus-<slug>/`.
#
# Usage:
#   tools/scripts/new-session.sh <NNN> <slug> [base-branch]
#
# Examples:
#   tools/scripts/new-session.sh 056 atlas-path-cleanup
#   tools/scripts/new-session.sh 061 spec013-... main
#
# After running, the script `cd`s the new worktree so subsequent commands
# operate inside it.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <NNN> <slug> [base-branch]" >&2
  echo "  NNN   — three-digit PR/branch number (e.g. 050)" >&2
  echo "  slug  — short kebab-case identifier (e.g. atlas-path-cleanup)" >&2
  echo "  base  — base branch (default: main)" >&2
  exit 2
fi

NNN="$1"
SLUG="$2"
BASE="${3:-main}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_PATH="${REPO_ROOT}/.worktrees/${SLUG}"
BRANCH="${NNN}-${SLUG}"

# Refuse to clobber an existing worktree or branch.
if git worktree list --porcelain | grep -q "branch ${BRANCH}\$"; then
  echo "error: branch '${BRANCH}' is already checked out in another worktree." >&2
  git worktree list | grep "${BRANCH}" || true
  exit 3
fi
if [[ -d "$WORKTREE_PATH" ]]; then
  echo "error: worktree path '${WORKTREE_PATH}' already exists." >&2
  exit 4
fi

# Ensure base branch exists locally; fall back to origin/<base> if needed.
if ! git rev-parse --verify --quiet "${BASE}" >/dev/null; then
  if git rev-parse --verify --quiet "origin/${BASE}" >/dev/null; then
    git branch "${BASE}" "origin/${BASE}" >/dev/null
  else
    echo "error: base branch '${BASE}' (or origin/${BASE}) not found." >&2
    exit 5
  fi
fi

git worktree add "$WORKTREE_PATH" -b "$BRANCH" "$BASE"

cat <<EOF

✓ worktree ready

  path:   $WORKTREE_PATH
  branch: $BRANCH (from $BASE)

Next steps:
  cd "$WORKTREE_PATH"
  npm install      # workspace symlinks re-resolve from the new working tree
  # ... make your edits, commit, push, open PR ...

Cross-session work goes through PR review (ADR-008 §2). If you must
switch branches inside this worktree, commit or stash first — git's
pre-checkout hook fires post-update and cannot prevent loss.
EOF
