#!/bin/bash
# force-compress.sh — SubagentStop hook that blocks agent if output not compressed
#
# Exit 0 = allow stop
# Exit 2 = block stop (stderr → Claude feedback)
#
# Skips: non-SubagentStop events

LOGFILE="/tmp/clnode-force-compress.log"
INPUT=$(cat 2>/dev/null) || exit 0

# jq required
command -v jq &>/dev/null || exit 0

# Extract fields
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null)
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty' 2>/dev/null)
echo "$(date): force-compress.sh invoked (event=$EVENT, agent=$AGENT_ID)" >> "$LOGFILE"

# Only enforce compression for SubagentStop
if [ "$EVENT" != "SubagentStop" ]; then
  echo "$(date): skipping — not SubagentStop" >> "$LOGFILE"
  exit 0
fi

# If already blocked once (stop_hook_active=true), allow through
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
if [ "$STOP_ACTIVE" = "true" ]; then
  echo "$(date): already blocked once, allowing through" >> "$LOGFILE"
  exit 0
fi

# Check agent transcript for [COMPRESSED] marker
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.agent_transcript_path // empty' 2>/dev/null)
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  if grep -q '\[COMPRESSED\]' "$TRANSCRIPT_PATH" 2>/dev/null; then
    echo "$(date): [COMPRESSED] marker found, allowing through" >> "$LOGFILE"
    exit 0
  fi
fi

# Block stop — tell agent to compress output directly
echo "$(date): BLOCKING — [COMPRESSED] marker not found" >> "$LOGFILE"
echo "[COMPRESSED] 마커가 없습니다. 지금 바로 작업 결과를 아래 형식으로 압축하여 반환하세요:
[COMPRESSED] agent_type: <type>
변경 파일: file1, file2
핵심 결과: (1-2줄 요약)
주요 결정사항: (있으면)
전체 코드나 상세 설명 없이 위 형식만 반환하세요. 300자 이내." >&2
exit 2
