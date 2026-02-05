<p align="center">
  <img src="docs/screenshots/01-dashboard.png" alt="clnode Dashboard" width="800">
</p>

<h1 align="center">clnode</h1>

<p align="center">
  <strong>Claude Code 스웜 인텔리전스 플러그인</strong><br>
  하나의 Claude Code 세션을 협업하는 개발팀으로
</p>

<p align="center">
  <a href="#빠른-시작">빠른 시작</a> •
  <a href="#작동-원리">작동 원리</a> •
  <a href="#기능">기능</a> •
  <a href="#web-ui">Web UI</a> •
  <a href="#cli">CLI</a>
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="./docs/GUIDE.en.md">User Guide (English)</a> •
  <a href="./docs/GUIDE.md">사용 가이드</a>
</p>

---

## 왜 clnode인가?

Claude Code의 멀티에이전트 모드에는 근본적인 한계가 있습니다: **에이전트끼리 대화할 수 없습니다.** 모든 결과가 Leader 에이전트를 거쳐야 하고, 리뷰 사이클을 몇 번 거치면 Leader의 컨텍스트가 폭발합니다.

clnode는 Claude Code의 hook 시스템을 활용해 공유 메모리 레이어를 만들어 이 문제를 해결합니다:

```
Agent A 완료 → 요약을 DB에 저장
Agent B 시작 → A의 요약을 자동으로 수신
Leader       → 결정만 내림, 컨텍스트 최소화
```

래퍼도, 커스텀 프레임워크도 없습니다. 빈 틈을 메우는 플러그인입니다.

## 빠른 시작

### Claude Code 사용자

Claude Code에서 이 명령어를 실행하세요:
```
curl -s https://raw.githubusercontent.com/SierraDevsec/clnode/main/docs/installation.md
```

Claude가 가이드를 읽고 자동으로 clnode를 설치합니다.

### 수동 설치

```bash
# 프로젝트 디렉토리에서
npx clnode init .

# 대시보드 열기
npx clnode ui
```

init 후 **Claude Code 세션을 재시작하세요** — hooks는 세션 시작 시 활성화됩니다.

### 개발용 설치

```bash
git clone https://github.com/SierraDevsec/clnode.git
cd clnode && pnpm install && pnpm build
node dist/cli/index.js start
```

## 작동 원리

<p align="center">
  <img src="docs/screenshots/02-agents.png" alt="Agent Tree" width="800">
</p>

clnode는 hooks를 통해 Claude Code의 에이전트 라이프사이클 이벤트를 가로챕니다:

1. **SubagentStart** → 이전 에이전트의 컨텍스트를 `additionalContext`로 주입
2. **SubagentStop** → 에이전트의 작업 요약을 추출하여 저장
3. **PostToolUse** → 파일 변경 추적 (Edit/Write)
4. **UserPromptSubmit** → 프로젝트 컨텍스트를 프롬프트에 자동 첨부

에이전트는 Leader를 통해서가 아니라 **시간을 통해** 대화합니다. Agent A가 DuckDB에 요약을 남기고, Agent B가 나중에 시작하면 자동으로 받습니다.

## 기능

### 스마트 컨텍스트 주입

단순히 최근 컨텍스트가 아니라 — **관련성 있는** 컨텍스트:

| 유형 | 설명 |
|------|------|
| **형제 에이전트 요약** | 같은 부모 아래 에이전트의 결과 |
| **같은 역할 히스토리** | 동일 역할의 이전 에이전트가 수행한 작업 |
| **크로스 세션** | 같은 프로젝트의 이전 세션 요약 |
| **태그된 컨텍스트** | 특정 에이전트를 위해 명시적으로 태그된 항목 |

### Todo Enforcer

미완료 태스크가 있는 상태로 에이전트가 종료되면 경고 — 조용한 실패 방지.

### 프롬프트 자동 첨부

모든 사용자 프롬프트에 자동으로 포함:
- 활성 에이전트와 상태
- 미완료 태스크 (상태별 우선순위)
- 최근 결정 사항과 블로커
- 완료된 에이전트 요약

## Web UI

`http://localhost:3100` 실시간 대시보드:

| 페이지 | 설명 |
|--------|------|
| **Dashboard** | 통계, 차트, 활성 세션 |
| **Agents** | 부모-자식 계층 에이전트 트리 |
| **Context** | 항목 전문 검색 |
| **Tasks** | 5단계 칸반 보드 |
| **Activity** | WebSocket 실시간 이벤트 로그 |

## CLI

```bash
clnode start              # 데몬 시작 (포트 3100)
clnode stop               # 데몬 중지
clnode status             # 활성 세션/에이전트 표시
clnode init [path]        # hooks 설치
clnode init --with-skills # 에이전트 템플릿도 설치
clnode ui                 # Web UI 열기
clnode logs [-f]          # 데몬 로그 보기/팔로우
```

## 요구 사항

- **Node.js** ≥ 22
- **jq** — `brew install jq` / `apt install jq`
- **curl** — 대부분의 시스템에 기본 설치

## 문제 해결

### DuckDB 바인딩 오류

```
Error: Cannot find module '.../duckdb/lib/binding/duckdb.node'
```

DuckDB는 플랫폼별 네이티브 바인딩이 필요합니다.

**로컬 설치:**
```bash
pnpm rebuild duckdb
# 또는
npm rebuild duckdb
```

**Docker:** Dockerfile에 빌드 도구 추가 후 리빌드:
```dockerfile
# Alpine
RUN apk add --no-cache python3 make g++

# Debian/Ubuntu
RUN apt-get update && apt-get install -y python3 make g++

# 의존성 설치 후 리빌드
RUN pnpm rebuild duckdb
```

**Docker 볼륨 마운트 시:** 호스트의 node_modules 제외:
```yaml
# docker-compose.yml
volumes:
  - .:/app
  - /app/node_modules  # 호스트 대신 컨테이너의 node_modules 사용
```

### clnode 명령어 찾을 수 없음

`pnpm install` 후 CLI를 전역으로 링크:
```bash
pnpm link --global
# 또는 직접 실행
node dist/cli/index.js start
```

## 아키텍처

```
src/
├── cli/           CLI 명령어
├── hooks/         hook.sh (stdin→stdout)
├── server/
│   ├── routes/    hooks.ts, api.ts, ws.ts
│   └── services/  intelligence.ts, agent.ts, session.ts, ...
└── web/           React 19 + TailwindCSS 4

templates/
├── hooks-config.json
├── skills/        에이전트 역할 템플릿
└── rules/         스웜 컨텍스트 규칙
```

**기술 스택**: Node.js 22, TypeScript, Hono, DuckDB, React 19, Vite 7, TailwindCSS 4

## 삭제

프로젝트에서 clnode를 완전히 제거하려면:

```bash
# 1. 데몬 중지
npx clnode stop

# 2. hooks 설정 제거
# .claude/settings.local.json 에서 "hooks" 섹션 삭제

# 3. clnode 템플릿 제거 (선택)
rm -rf .claude/agents/reviewer.md .claude/agents/worker.md
rm -rf .claude/skills/compress-context .claude/skills/session-usage .claude/skills/clnode-agents
rm -rf .claude/rules/clnode-usage.md

# 4. clnode 데이터 제거 (선택 - 세션 히스토리 삭제)
rm -rf ~/.npm/_npx/**/node_modules/clnode/data
```

**참고**: hooks 제거 후 Claude Code 세션을 재시작하세요.

## 이슈 및 피드백

버그를 발견했거나 기능 요청이 있으신가요?

👉 [이슈 등록하기](https://github.com/SierraDevsec/clnode/issues)

## 라이센스

Source Available — 비상업적 용도는 자유롭게 사용 가능. 상업적 이용은 라이센스 필요. [LICENSE](./LICENSE) 참고.

---

<p align="center">
  AI가 챗봇이 아닌 팀처럼 일하길 원하는 개발자를 위해 만들었습니다.
</p>
