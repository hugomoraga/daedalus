#!/usr/bin/env bash
# tools/scripts/setup.sh — verify env + install deps for Daedalus.
#
# Run once per fresh clone or new worktree. Idempotent.
# Optional skills are checked but never auto-installed (they live in
# ~/.claude/skills/ or ~/.agents/skills/ — machine-scoped, not project-scoped;
# opencode auto-loads them).
#
# Usage:
#   tools/scripts/setup.sh
#
# Exit codes:
#   0 — ready
#   1 — missing required dep

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

NODE_MAJOR="$(node -v | cut -d. -f1 | tr -d v)"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "✗ node 22+ required (found $(node -v))" >&2
  exit 1
fi
command -v git >/dev/null || { echo "✗ git not found" >&2; exit 1; }

if [[ -d "${REPO_ROOT}/node_modules" ]]; then
  echo "→ node_modules present, skipping npm install"
else
  echo "→ running npm install"
  npm --prefix "$REPO_ROOT" install
fi

warn_if_missing() {
  local name="$1"
  if [[ ! -f "${HOME}/.claude/skills/${name}/SKILL.md" \
     && ! -f "${HOME}/.agents/skills/${name}/SKILL.md" ]]; then
    echo "⚠ optional skill '${name}' not found in ~/.claude/skills/ or ~/.agents/skills/"
  fi
}
warn_if_missing "last30days"

echo "✓ ready"