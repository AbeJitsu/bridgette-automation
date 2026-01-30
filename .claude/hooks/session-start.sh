#!/bin/bash
# SessionStart Hook: Sync shared memory + show git status
# What: Runs when session starts, resumes, or after compacting
# Why: Pull latest memory from git, show current branch context

# Sync shared memory repo
MEMORY_DIR="$HOME/claude-memory"
if [[ -d "$MEMORY_DIR/.git" ]]; then
  cd "$MEMORY_DIR" && git pull --rebase 2>/dev/null
  MEMORY_STATUS="synced"
else
  MEMORY_STATUS="not found"
fi

_GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$_GIT_ROOT" ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Memory: $MEMORY_STATUS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
fi

cd "$_GIT_ROOT"

BRANCH=$(git branch --show-current 2>/dev/null)
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Branch: $BRANCH"
if [[ "$UNCOMMITTED" -gt 0 ]]; then
  echo "Uncommitted changes: $UNCOMMITTED files"
fi
echo "Memory: $MEMORY_STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
