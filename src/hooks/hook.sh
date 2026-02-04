#!/bin/bash
# clnode hook script — Claude Code stdin→stdout protocol
# Claude Code → stdin(JSON) → hook.sh → curl POST daemon → stdout(JSON) → Claude Code

INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
RESPONSE=$(echo "$INPUT" | curl -sf -X POST \
  -H "Content-Type: application/json" \
  -d @- \
  "http://localhost:3100/hooks/${EVENT}" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$RESPONSE" ]; then
  echo "$RESPONSE"
  exit 0
else
  exit 0
fi
