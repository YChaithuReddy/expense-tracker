#!/bin/bash
# Pre-Commit Quality Gate Hook (PreToolUse on Bash for git commit)
# Catches common issues before they get committed

# Read JSON input from stdin
INPUT=$(cat)

# Extract the bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only run for git commit commands
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

ISSUES=""
ISSUE_COUNT=0

# Check 1: Leftover console.log in staged JS files
CONSOLE_LOGS=$(git diff --cached --name-only -- '*.js' | xargs grep -l 'console\.log' 2>/dev/null | head -5)
if [[ -n "$CONSOLE_LOGS" ]]; then
  ISSUES+="WARNING: console.log found in staged files: $CONSOLE_LOGS\n"
  ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# Check 2: !important in staged CSS files
IMPORTANT_CSS=$(git diff --cached -- '*.css' | grep '+.*!important' 2>/dev/null | head -5)
if [[ -n "$IMPORTANT_CSS" ]]; then
  ISSUES+="WARNING: New !important added in CSS. This often causes override conflicts. Verify it's intentional.\n"
  ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# Check 3: fire-and-forget async (async function without await at call site)
ASYNC_ISSUES=$(git diff --cached -- '*.js' | grep -E '^\+.*async\s+' 2>/dev/null | head -5)
if [[ -n "$ASYNC_ISSUES" ]]; then
  ISSUES+="REMINDER: New async code detected. Ensure all async calls are awaited (no fire-and-forget).\n"
  ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# Check 4: Verify frontend build is synced
if git diff --cached --name-only | grep -qE '^frontend/.*(\.js|\.html|\.css)$'; then
  if [[ ! -f "frontend/www/index.html" ]] || [[ "frontend/index.html" -nt "frontend/www/index.html" ]]; then
    ISSUES+="WARNING: Frontend files changed but www/ may be stale. Run 'node build.js && npx cap sync android' before committing.\n"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
  fi
fi

# Output results
if [[ $ISSUE_COUNT -gt 0 ]]; then
  cat << EOF
{
  "systemMessage": "PRE-COMMIT QUALITY GATE ($ISSUE_COUNT issues):\n$ISSUES\nReview these before proceeding with the commit. Fix any real issues, or confirm they are intentional."
}
EOF
else
  cat << EOF
{
  "systemMessage": "PRE-COMMIT QUALITY GATE: All checks passed."
}
EOF
fi

exit 0
