# clnode

**Claude Code 스웜 인텔리전스 플러그인** — 나만의 개발팀, 24시간 가동.

혼자서도 5인 팀처럼 일할 수 있습니다. 백엔드, 프론트엔드, 리뷰어, 테스터 에이전트가 병렬로 돌면서 서로의 결과를 자동으로 이어받습니다.

API 키 필요 없음. 추가 모델 비용 없음. 설정 없음. `clnode init` 하면 끝.

## 만들게 된 배경

실제 프로젝트에서 Claude Code의 멀티에이전트 모드를 쓰고 있었습니다. Leader 에이전트가 백엔드, 프론트엔드, 리뷰어 에이전트에게 작업을 분배하는 구조였습니다.

처음엔 잘 돌아갔습니다. 그런데 리뷰어가 문제를 발견했습니다.

리뷰어의 피드백은 Leader에게 돌아가야 했습니다. Leader가 다시 작업을 할당했습니다. 구현자가 수정했습니다. 결과가 다시 Leader를 거쳐 리뷰어에게 갔습니다. 리뷰어가 다시 확인했습니다. 또 실패. 다시 Leader로.

**매 라운드트립마다 Leader의 컨텍스트가 쌓였습니다.** 리뷰 사이클을 몇 번 거치자 Leader의 컨텍스트 윈도우가 가득 찼습니다. 뭘 했는지, 뭐가 남았는지, 뭐가 실패했는지 추적을 잃기 시작했습니다. 세션이 무너졌습니다.

원인은 단순했습니다: **에이전트끼리 대화할 수 없다.** 모든 것이 Leader를 거쳐야 하고, Leader가 병목이 됩니다.

## 해결 방법

Claude Code가 이미 제공하는 두 가지 기능을 발견했습니다 — **hooks**(라이프사이클 이벤트 인터셉터)와 **skills**(에이전트 역할 정의). hooks의 `additionalContext`를 stdout으로 주입할 수 있다는 것. 그게 전부였습니다.

clnode는 hooks로 에이전트 라이프사이클 이벤트를 가로채고, DuckDB를 공유 메모리로 씁니다. Agent A가 끝나면 요약이 DB에 저장됩니다. Agent B가 시작되면 A의 요약을 자동으로 받습니다 — Leader 중계 불필요.

별도의 프레임워크도, 래퍼도 없습니다. 기존 시스템의 빈 틈을 정확히 메운 플러그인입니다.

```
Agent A 완료 → 요약을 DB에 저장
Agent B 시작 → additionalContext로 A의 요약을 수신
Leader       → 고수준 결정만 내림, 컨텍스트 최소화
```

### 왜 동작하는가

- **`additionalContext` 주입은 공식 hook 프로토콜** — Claude Code의 `SubagentStart` hook이 stdout으로 `additionalContext`를 반환할 수 있습니다. clnode는 이걸로 이전 에이전트의 결과를 새 에이전트에 주입합니다. 해킹이 아니라 정식 확장입니다.
- **DuckDB는 에이전트 간 우편함** — 에이전트끼리 직접 대화하지 않습니다. Agent A가 끝나고 요약을 DB에 남깁니다. Agent B가 나중에 시작하면 자동으로 받습니다. 시간을 통해 대화하는 구조입니다.
- **Leader 컨텍스트가 깨끗하게 유지됨** — 기존 Claude Code에서는 리뷰 사이클("리뷰 실패 → Leader에게 전달 → Leader가 재할당 → 구현자 수정 → 다시 전달")마다 Leader에 컨텍스트가 쌓여서 한계에 도달합니다. clnode는 이 조율 상태를 DB로 외부화합니다.
- **Zero lock-in** — clnode는 hooks와 skills만 사용합니다. 둘 다 Claude Code 공식 기능입니다. 플러그인을 제거하면 프로젝트는 원래대로 동작합니다.

## 빠른 시작

```bash
# 1. 설치
npm install -g clnode

# 2. 데몬 시작
clnode start

# 3. 프로젝트 초기화
cd your-project
clnode init

# 4. Web UI 열기
clnode ui
```

끝입니다. Claude Code가 이제 clnode를 통해 에이전트를 자동으로 조율합니다.

## 작동 원리

```
Claude Code 세션
│
├── Agent A 시작  ──→  hook.sh  ──→  clnode 데몬  ──→  DuckDB
├── Agent A 종료  ──→  hook.sh  ──→  clnode 데몬  ──→  DuckDB (요약 저장)
├── Agent B 시작  ──→  hook.sh  ──→  clnode 데몬  ──→  DuckDB (A의 요약 읽기)
│                                        │
│                                        └──→  stdout: additionalContext
│                                              (A의 결과가 B에 주입됨)
└── Leader는 최종 보고만 받음 — 컨텍스트 최소화
```

1. **hooks**가 에이전트 라이프사이클 이벤트를 가로챔 (시작, 종료, 도구 사용 등)
2. **hook.sh**가 stdin에서 JSON을 읽고, 데몬에 POST하고, stdout으로 응답 반환
3. **DuckDB**가 에이전트 간 공유 메모리 역할
4. `SubagentStart` 시: 데몬이 이전 에이전트의 컨텍스트를 `additionalContext`로 반환
5. `SubagentStop` 시: 데몬이 에이전트의 작업 요약을 저장

**에이전트는 직접 대화하지 않습니다. 시간을 통해 대화합니다.** Agent A가 DB에 요약을 남기고, Agent B가 나중에 시작하면 자동으로 받습니다.

## 스마트 컨텍스트 주입

clnode는 단순히 최근 컨텍스트를 반환하지 않습니다 — **관련성 있는** 컨텍스트를 선택합니다:

- **형제 에이전트 요약**: 같은 부모 아래 다른 에이전트의 결과
- **같은 역할 히스토리**: 같은 유형의 이전 에이전트가 무엇을 했는지
- **크로스 세션 컨텍스트**: 같은 프로젝트의 이전 Claude Code 세션 요약
- **태그된 컨텍스트**: 특정 에이전트를 위해 명시적으로 태그된 항목
- **Todo Enforcer**: 미완료 태스크가 있는 상태로 에이전트가 종료되면 경고
- **프롬프트 자동 첨부**: 사용자 프롬프트에 프로젝트 컨텍스트 자동 포함 (활성 에이전트, 미완료 태스크, 최근 결정 사항)

## CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `clnode start` | 데몬 시작 (기본 포트 3100) |
| `clnode stop` | 데몬 중지 |
| `clnode status` | 활성 세션/에이전트 표시 |
| `clnode init [path]` | 프로젝트에 hooks 설치 |
| `clnode init --with-skills` | hooks + 에이전트 스킬 템플릿 설치 |
| `clnode ui` | 브라우저에서 Web UI 열기 |

### 옵션

```bash
clnode start --port 3200       # 커스텀 포트
CLNODE_PORT=3200 clnode start  # 환경 변수로 포트 지정
```

## Web UI

`http://localhost:3100` 내장 대시보드:

- **Dashboard** — 활성 세션, 에이전트 수, 최근 활동 타임라인
- **Agents** — 에이전트 트리 (부모-자식 계층), 상태 필터
- **Context** — 컨텍스트 항목 전문 검색, 태그 필터
- **Tasks** — 칸반 보드 (대기 → 진행 중 → 완료)
- **Activity** — WebSocket 실시간 이벤트 로그

## 요구 사항

- **Node.js** >= 22
- **jq** — hook.sh JSON 파싱용 (`brew install jq` / `apt install jq`)
- **curl** — hook.sh HTTP 호출용 (대부분의 시스템에 기본 설치)

## 프로젝트 구조

```
src/
  cli/index.ts              CLI 진입점
  hooks/hook.sh             stdin→stdout hook 스크립트
  server/
    index.ts                Hono 서버 (포트 3100)
    db.ts                   DuckDB 스키마 (7개 테이블)
    routes/
      hooks.ts              POST /hooks/:event
      api.ts                GET /api/*
      ws.ts                 WebSocket 브로드캐스트
    services/
      intelligence.ts       스마트 컨텍스트 주입 + Todo Enforcer
      agent.ts, session.ts, context.ts, ...
  web/                      React 19 + TailwindCSS 4 SPA
templates/
  hooks-config.json         Hook 설정 템플릿
  skills/                   에이전트 역할 템플릿
```

## API

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /hooks/:event` | Hook 이벤트 핸들러 |
| `GET /api/health` | 헬스 체크 |
| `GET /api/sessions` | 세션 목록 |
| `GET /api/agents` | 에이전트 목록 |
| `GET /api/tasks` | 태스크 목록 |
| `GET /api/activities` | 활동 로그 |
| `GET /ws` | WebSocket 실시간 이벤트 |

## 라이센스

Source Available — 비상업적 용도는 자유롭게 사용 가능. 상업적 이용은 라이센스 필요. 자세한 내용은 [LICENSE](./LICENSE) 참고.
