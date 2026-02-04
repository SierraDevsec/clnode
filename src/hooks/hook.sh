#!/usr/bin/env bash
# clnode hook script — Claude Code hooks에서 호출됨
# 사용법: hook.sh <event_name> [stdin: JSON payload]

set -euo pipefail

CLNODE_URL="${CLNODE_URL:-http://localhost:3100}"
EVENT="${1:-unknown}"

# stdin에서 JSON payload 읽기 (없으면 빈 객체)
PAYLOAD=$(cat 2>/dev/null || echo '{}')
if [ -z "$PAYLOAD" ]; then
  PAYLOAD='{}'
fi

# clnode 서버로 전송 (실패해도 Claude Code 블로킹 안 함)
curl -s -X POST \
  "${CLNODE_URL}/hooks/${EVENT}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  --max-time 2 \
  > /dev/null 2>&1 || true
