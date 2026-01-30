#!/bin/bash
# Pre-Compact Hook - Save work state + write to shared memory
# Saves git state and writes session summary to ~/claude-memory/

WORK_STATE_FILE="/tmp/claude_work_state.json"

# Get current git status
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
UNCOMMITTED_FILES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
PROJECT=$(basename "$(pwd)")

# Save work state (local)
cat > "$WORK_STATE_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "branch": "$GIT_BRANCH",
  "uncommitted_files": $UNCOMMITTED_FILES,
  "working_directory": "$(pwd)"
}
EOF

# Write session summary to shared memory
DATE=$(date +%Y-%m-%d)
MEMORY_DIR="$HOME/claude-memory/memory"
MEMORY_FILE="$MEMORY_DIR/$DATE.md"

if [[ -d "$HOME/claude-memory" ]]; then
  mkdir -p "$MEMORY_DIR"

  cat >> "$MEMORY_FILE" << EOF

## Claude Code IDE Session ($(date +%H:%M))
- **Project:** $PROJECT
- **Branch:** $GIT_BRANCH
- **Working dir:** $(pwd)
- **Modified files:** $(git diff --name-only 2>/dev/null | head -10 | tr '\n' ', ')

EOF

  # Auto-commit and push memory
  cd "$HOME/claude-memory" && git add -A && git commit -m "memory: IDE session $PROJECT @ $GIT_BRANCH" && git push 2>/dev/null
  MEMORY_STATUS="updated"
else
  MEMORY_STATUS="not found"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "WORK STATE SAVED BEFORE COMPACTION"
echo "   Branch: $GIT_BRANCH"
if [ "$UNCOMMITTED_FILES" -gt 0 ]; then
  echo "   Uncommitted: $UNCOMMITTED_FILES files"
fi
echo "   Memory: $MEMORY_STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
