#!/bin/bash
# SessionStart Hook: Show git status
# What: Runs when session starts, resumes, or after compacting
# Why: Quick context on current branch and changes

_GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$_GIT_ROOT" ]]; then
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
