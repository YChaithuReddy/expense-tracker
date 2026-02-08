#!/bin/bash
# Auto-sync Capacitor after frontend file changes

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path from tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Check if it's a frontend JS/HTML/CSS file (but not in android folder)
if [[ "$FILE_PATH" == *"/frontend/"* ]] && [[ "$FILE_PATH" != *"/frontend/android/"* ]]; then
  if [[ "$FILE_PATH" == *.js ]] || [[ "$FILE_PATH" == *.html ]] || [[ "$FILE_PATH" == *.css ]]; then
    # Run cap sync in background (async)
    cd "$(dirname "$FILE_PATH")/.." 2>/dev/null || cd frontend
    npx cap sync android --silent 2>/dev/null &

    echo '{"systemMessage": "Capacitor sync triggered for Android"}'
    exit 0
  fi
fi

exit 0
