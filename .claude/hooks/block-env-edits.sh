#!/bin/bash
# Block edits to .env files to protect sensitive credentials

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path from tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Check if it's a .env file
if [[ "$FILE_PATH" == *".env"* ]] || [[ "$FILE_PATH" == *".env."* ]]; then
  # Output JSON to deny the action
  cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Cannot edit .env files directly. Use environment variables or ask the user to edit manually."
  }
}
EOF
  exit 0
fi

# Allow other files
exit 0
