#!/bin/bash
# Workflow Enforcer Hook (UserPromptSubmit)
# Fires on every user prompt to remind Claude of mandatory procedures

# Read JSON input from stdin
INPUT=$(cat)

# Extract the user's prompt text
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')

# Convert to lowercase for matching
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Detect task type from prompt keywords
IS_BUG=false
IS_FEATURE=false
IS_FIX=false
IS_REFACTOR=false
IS_STYLE=false

[[ "$PROMPT_LOWER" == *"bug"* ]] || [[ "$PROMPT_LOWER" == *"broken"* ]] || [[ "$PROMPT_LOWER" == *"not working"* ]] || [[ "$PROMPT_LOWER" == *"error"* ]] && IS_BUG=true
[[ "$PROMPT_LOWER" == *"add"* ]] || [[ "$PROMPT_LOWER" == *"create"* ]] || [[ "$PROMPT_LOWER" == *"implement"* ]] || [[ "$PROMPT_LOWER" == *"new feature"* ]] && IS_FEATURE=true
[[ "$PROMPT_LOWER" == *"fix"* ]] || [[ "$PROMPT_LOWER" == *"debug"* ]] || [[ "$PROMPT_LOWER" == *"why"* ]] || [[ "$PROMPT_LOWER" == *"issue"* ]] && IS_FIX=true
[[ "$PROMPT_LOWER" == *"refactor"* ]] || [[ "$PROMPT_LOWER" == *"clean"* ]] || [[ "$PROMPT_LOWER" == *"improve"* ]] || [[ "$PROMPT_LOWER" == *"optimize"* ]] && IS_REFACTOR=true
[[ "$PROMPT_LOWER" == *"css"* ]] || [[ "$PROMPT_LOWER" == *"style"* ]] || [[ "$PROMPT_LOWER" == *"layout"* ]] || [[ "$PROMPT_LOWER" == *"design"* ]] || [[ "$PROMPT_LOWER" == *"ui"* ]] && IS_STYLE=true

# Build context-aware reminder
REMINDER="MANDATORY WORKFLOW REMINDER:\n"
REMINDER+="1. Follow the 7-step process (Understanding > Classification > Agents > Root Cause > Strategy > Implementation > Validation)\n"
REMINDER+="2. Create a TaskList BEFORE starting work (TaskCreate for each step)\n"
REMINDER+="3. Check MEMORY.md for past bugs and known patterns before proposing fixes\n"

if $IS_BUG || $IS_FIX; then
  REMINDER+="4. BUG/FIX DETECTED: Do NOT jump to code. Find root cause FIRST. Check anti-patterns.md and file-map.md for known traps.\n"
fi

if $IS_STYLE; then
  REMINDER+="4. CSS DETECTED: Check ALL classes on the element. Search ALL 3 CSS files (styles.css, styles_images.css, styles_dropdown.css). Watch for !important traps.\n"
fi

if $IS_FEATURE; then
  REMINDER+="4. NEW FEATURE: Use EnterPlanMode for non-trivial features. Create implementation tasks before writing code.\n"
fi

if $IS_REFACTOR; then
  REMINDER+="4. REFACTOR: Minimal changes only. Preserve existing behavior. No over-engineering.\n"
fi

REMINDER+="5. After ALL changes: invoke /learn-and-remember to update memory files.\n"

# Output as system message
cat << EOF
{
  "systemMessage": "$REMINDER"
}
EOF

exit 0
