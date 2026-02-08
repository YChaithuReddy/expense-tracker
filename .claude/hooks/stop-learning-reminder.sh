#!/bin/bash
# Stop Hook - Auto-trigger learning when Claude finishes a task
# Fires when Claude stops responding (task complete or paused)

# Read JSON input from stdin
INPUT=$(cat)

# Extract the stop reason
STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // "unknown"')

# Extract conversation summary (tool uses indicate code changes)
TOOL_USES=$(echo "$INPUT" | jq -r '.tool_use_count // 0')
EDIT_COUNT=$(echo "$INPUT" | jq -r '.tool_uses.Edit // 0')
WRITE_COUNT=$(echo "$INPUT" | jq -r '.tool_uses.Write // 0')
BASH_COUNT=$(echo "$INPUT" | jq -r '.tool_uses.Bash // 0')

# Calculate if code was changed
CODE_CHANGED=false
if [[ "$EDIT_COUNT" -gt 0 ]] || [[ "$WRITE_COUNT" -gt 0 ]]; then
  CODE_CHANGED=true
fi

# Build reminder message
if $CODE_CHANGED; then
  cat << 'EOF'
{
  "systemMessage": "SESSION COMPLETE - CODE WAS CHANGED.\n\nBefore ending, you MUST:\n1. Verify all tasks in TaskList are marked 'completed'\n2. Invoke /learn-and-remember to record what was learned\n3. Update: MEMORY.md (bugs/rules), CLAUDE.md (common issues), debugging-log.md (fix record)\n4. Check regression-checklist.md items are satisfied\n\nDo NOT skip the learning step. Future sessions depend on this memory."
}
EOF
else
  cat << 'EOF'
{
  "systemMessage": "Session complete. No code changes detected - learning update optional."
}
EOF
fi

exit 0
