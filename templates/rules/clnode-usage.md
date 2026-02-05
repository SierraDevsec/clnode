# clnode 사용 규칙

clnode는 Claude Code 멀티에이전트 협업을 위한 swarm intelligence 플러그인입니다.
에이전트 간 컨텍스트 공유, 태스크 관리, 세션 추적 기능을 제공합니다.

## 컨텍스트 압축 (필수)

에이전트 결과(context_summary)가 **1000자를 초과**하면 반드시 `/compress-context` 스킬을 사용하세요.

```
/compress-context
```

압축하지 않으면:
- Leader 에이전트의 컨텍스트가 폭발
- 토큰 낭비 및 응답 품질 저하
- 멀티에이전트 체인 중단 위험

## 세션 토큰 사용량

현재 세션의 토큰 사용량과 에이전트별 breakdown을 확인하려면:

```
/session-usage
```

## Web UI

clnode Web UI에서 실시간으로 확인 가능:
- Dashboard: 활성 세션, 에이전트, 토큰 사용량
- Agents: 에이전트 트리 및 상태
- Tasks: 태스크 칸반 보드
- Context: 컨텍스트 엔트리 목록
- Activity: 이벤트 로그

```
http://localhost:3100
```

## 태스크 관리

clnode는 6단계 칸반으로 태스크를 관리합니다:

```
Idea → Planned → Pending → In Progress → Needs Review → Completed
```

### 에이전트와 태스크 연동
- SubagentStart: pending 태스크가 있으면 자동으로 in_progress + assigned
- SubagentStop: in_progress 태스크가 있으면 자동으로 completed

### 수동 태스크 조작 (필요시)
Web UI 또는 API를 통해 직접 관리:
```bash
# 태스크 목록
curl http://localhost:3100/api/tasks

# 태스크 생성
curl -X POST http://localhost:3100/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "태스크 제목", "description": "설명"}'
```

## 컨텍스트 공유

에이전트가 종료되면 context_summary가 자동으로 DB에 저장됩니다.
다음 에이전트 시작 시 이전 에이전트들의 결과가 자동 주입됩니다.

### 수동 컨텍스트 추가 (필요시)
```bash
curl -X POST http://localhost:3100/hooks/PostContext \
  -H "Content-Type: application/json" \
  -d '{"session_id": "...", "entry_type": "decision", "content": "결정사항 내용"}'
```

entry_type 종류:
- `decision`: 아키텍처/기술 결정
- `blocker`: 차단 이슈
- `note`: 일반 메모
- `agent_summary`: 에이전트 결과 요약

## 에이전트 간 협업

### Leader가 해야 할 것
- 태스크 분배 전 전체 계획 수립
- 에이전트 결과를 사용자에게 요약 (전체 relay X)
- 리뷰 결과에 따른 재작업 조율

### 에이전트가 해야 할 것
- 결과 보고 시 **변경 파일 목록 + 핵심 결정사항**만 간결하게
- 1000자 초과 시 `/compress-context` 필수
- 블로커 발견 시 즉시 보고
