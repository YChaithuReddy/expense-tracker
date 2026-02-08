#!/bin/bash
# SessionStart Hook - Load fresh context at the beginning of every session
# Ensures Claude starts every session with full codebase awareness

cat << 'EOF'
{
  "systemMessage": "NEW SESSION STARTED.\n\nBefore doing ANY work, orient yourself:\n\n1. MEMORY.md is auto-loaded (key rules, past bugs, architecture)\n2. Read memory/anti-patterns.md if debugging (16 known traps)\n3. Read memory/file-map.md if editing files (blast radius map)\n4. Read memory/debugging-log.md for recent fix history\n5. Read memory/regression-checklist.md after any code change\n6. Use /codebase-decision-trees for structured debugging\n\nMandatory rules:\n- Follow 7-step workflow for ALL tasks\n- Use TaskCreate/TaskUpdate for ALL multi-step work\n- After completing work → /learn-and-remember to update memory\n- NEVER skip root cause analysis\n- NEVER add !important to CSS\n- NEVER fire-and-forget async calls"
}
EOF

exit 0
