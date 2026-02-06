# clnode — Claude Code Swarm Intelligence Plugin

## Why This Exists

Claude Code supports multi-agent mode (spawning subagents via the Task tool),
but **agents cannot communicate with each other**. Each agent runs in an
isolated context and has no awareness of what other agents are doing or have done.

This creates a critical problem: **the Leader agent's context explodes**.
When a reviewer finds issues and work needs to be re-assigned, everything
must flow through the Leader. Every round-trip of "review failed → tell Leader
→ Leader re-assigns → implementer fixes → send back" piles up context on the
Leader's window until it hits limits and loses track.

**clnode solves this by externalizing agent coordination state to a local DB.**

Using Claude Code's built-in features — **hooks**, **agents**, **skills**, and
**rules** — clnode builds a swarm mode layer on top of vanilla Claude Code:

- **hooks** intercept agent lifecycle events and route context through DuckDB
- **agents** define subagent roles (backend-dev, reviewer, etc.)
- **skills** provide user-invoked commands and agent-preloaded behaviors (/compress-output, /compress-review)
- **rules** enforce project-wide conventions (auto-loaded every conversation)
- **DuckDB** acts as shared memory between agents (the communication channel)

When Agent B starts, the SubagentStart hook automatically injects Agent A's
results via `additionalContext` — no Leader relay needed. The Leader stays lean,
only making high-level decisions instead of carrying every intermediate result.

## Architecture

```
Claude Code Session (no native swarm support)
│
├── Agent A starts  ──→  hook ──→  clnode daemon ──→  DuckDB (store)
├── Agent A stops   ──→  hook ──→  clnode daemon ──→  DuckDB (save summary)
├── Agent B starts  ──→  hook ──→  clnode daemon ──→  DuckDB (read A's summary)
│                                       │
│                                       └──→ stdout: additionalContext
│                                             (A's results injected into B)
└── Leader only sees final reports — context stays minimal
```

## Key Insight

**Agents don't talk to each other directly. They talk through time.**
Agent A finishes and leaves a summary in DB. Agent B starts later and
receives that summary automatically. The hook system is the message bus,
DuckDB is the mailbox.

## Tech Stack
- **Runtime**: Node.js v22, TypeScript, ESM (type: module)
- **Server**: Hono + @hono/node-server + @hono/node-ws
- **DB**: DuckDB (duckdb-async) — `data/clnode.duckdb`
- **CLI**: commander.js
- **Web UI**: React 19 + Vite 7 + TailwindCSS 4 + react-icons
- **Test**: Vitest
- **Package Manager**: pnpm

## Directory Structure
```
src/
  cli/index.ts          — CLI entry point (clnode start/stop/init/status/ui/logs)
  hooks/hook.sh         — stdin→stdout hook script (jq + curl)
  server/
    index.ts            — Hono server entry point (port 3100)
    db.ts               — DuckDB connection + schema initialization
    routes/
      hooks.ts          — POST /hooks/:event (7 event handlers + RegisterProject)
      api.ts            — GET/PATCH/DELETE /api/* (REST API)
      ws.ts             — WebSocket broadcast utility
    services/
      project.ts        — Project registration
      session.ts        — Session lifecycle
      agent.ts          — Agent lifecycle + context_summary
      context.ts        — Context entries (entry_type, content, tags[])
      filechange.ts     — File change tracking (Edit/Write)
      task.ts           — Task state tracking (5-stage)
      comment.ts        — Task comments CRUD
      activity.ts       — Activity log (details JSON)
      intelligence.ts   — Smart context injection + todo enforcer
  web/                  — React SPA (Dashboard, Agents, Context, Tasks, Activity)
    components/Layout.tsx — embed mode (?embed=true) 지원: 사이드바 숨김 + 투명 배경
    lib/ProjectContext.tsx — URL ?project=<id> 파라미터로 초기 프로젝트 선택 지원
vscode-extension/       — VSCode Extension (독립 패키지)
  src/
    extension.ts        — activate: 사이드바 + 상태바 + 커맨드 등록
    sidebar-view.ts     — WebviewViewProvider: 커스텀 HTML 사이드바 (stats + nav + project selector)
    webview/panel.ts    — WebviewPanel: 에디터 영역에 iframe 웹뷰
    webview/html-provider.ts — iframe HTML 생성 (?embed=true&project=<id>)
    auto-init.ts        — 워크스페이스 자동 init + 프로젝트 등록
    daemon.ts           — 데몬 health check + start/stop
    api-client.ts       — REST client
    status-bar.ts       — 상태바 아이템
templates/
  hooks-config.json     — Hooks config template
  agents/               — 7 agent role definitions (clnode-curator, backend-dev, frontend-dev, reviewer, etc.)
  skills/               — Skills (compress-output, compress-review, clnode-agents)
  rules/                — Swarm context rules (team, typescript, react, nodejs)
```

## DuckDB Schema (8 tables)
- **projects**: id, name, path (UNIQUE), created_at
- **sessions**: id, project_id, started_at, ended_at, status
- **agents**: id, session_id, agent_name, agent_type, parent_agent_id, status, started_at, completed_at, context_summary
- **context_entries**: id, session_id, agent_id, entry_type, content, tags[], created_at
- **file_changes**: id, session_id, agent_id, file_path, change_type, created_at
- **tasks**: id, project_id, title, description, status, assigned_to, tags[], created_at, updated_at
- **task_comments**: id, task_id, author, comment_type, content, created_at
- **activity_log**: id, session_id, agent_id, event_type, details JSON, created_at

## Hook Events
| Event | Purpose |
|-------|---------|
| SessionStart | Register session, link to project |
| SubagentStart | Register agent, return additionalContext (smart context injection) |
| SubagentStop | Finalize agent, extract context_summary from transcript |
| PostToolUse | Track file changes (Edit/Write) |
| UserPromptSubmit | Return project context (active agents, open tasks, decisions) |
| RegisterProject | Register project in DB (used by `clnode init`) |

## CLI Commands
```bash
clnode start            # Start daemon (background)
clnode stop             # Stop daemon
clnode status           # Show active sessions/agents
clnode init [path]      # Install hooks + register project
clnode init --with-skills  # Also copy agents/skills/rules templates
clnode ui               # Open Web UI in browser
clnode logs [-n N] [-f] # View daemon logs
```

## Development Commands
```bash
pnpm dev          # Dev server with tsx
pnpm build        # TypeScript + Vite build
pnpm test         # Run tests
pnpm test:watch   # Watch mode
```

## Important Notes
- Use `now()` instead of `current_timestamp` in DuckDB
- DuckDB `COUNT(*)` returns BigInt → wrap with `Number()`
- DuckDB VARCHAR[] needs literal construction, not bind params
- hook.sh exits 0 even on failure (never blocks Claude Code)
- hook.sh has 3s curl timeout, requires `jq`
- Server port: env var CLNODE_PORT (default 3100)

## VSCode Extension

### Architecture
```
VSCode Extension (경량 클라이언트)
├── Sidebar WebviewView — 커스텀 HTML (stats 2x2 grid + nav buttons + project selector)
├── Editor WebviewPanel — iframe으로 Web UI embed (?embed=true&project=<id>)
├── Status Bar — "clnode: N agents" 또는 "clnode: offline"
└── Auto-Init — 워크스페이스 열 때 hooks 설치 + 프로젝트 DB 등록
     ↓ HTTP/WS
clnode daemon (이미 실행 중)
```

### Key Design Decisions
- **서버 미내장**: Extension은 데몬에 HTTP로 연결하는 클라이언트만
- **iframe embed**: Web UI를 그대로 재사용. `?embed=true`로 사이드바 숨김 + 투명 배경
- **커스텀 사이드바 HTML**: VSCode CSS 변수(`var(--vscode-foreground)` 등)로 테마 호환
- **반응형 사이드바**: CSS container query로 1열/2열/4열 자동 전환
- **프로젝트 자동 선택**: 워크스페이스 path를 DB projects.path와 매칭
- **CJS 출력**: VSCode extension은 반드시 CommonJS (`format: 'cjs'`)

### Extension Build & Deploy
```bash
cd vscode-extension
pnpm build              # esbuild → dist/extension.js (CJS)
pnpm package            # vsce package → .vsix
code --install-extension clnode-vscode-*.vsix --force
# VSCode: Cmd+Shift+P → "Developer: Reload Window"
```

### Important Notes (Extension)
- `npx clnode start`는 npm 캐시에서 실행됨 → 로컬 개발 시 `node dist/server/index.js` 직접 실행
- Web UI 변경 시 `pnpm build` (root) → 데몬 재시작 → extension rebuild → install → VSCode reload 필요
- `window.open()` 함수명 충돌 주의: webview에서 `open()` 대신 `openPage()` 등 사용
- Extension list 아이콘은 PNG 필수 (SVG 불가): `rsvg-convert` 로 변환
- `acquireVsCodeApi()`는 webview당 1회만 호출 가능
- sidebar webview에서 `vscode.getState()`/`vscode.setState()`로 선택 상태 유지
- `container-type: inline-size`가 있어야 `@container` 쿼리 동작
- `autoInitWorkspace`는 hooks/agents 유무와 무관하게 항상 `registerProject` 호출

## Known Issues
- Hooks require Claude Code session restart after `clnode init`
- Agent killed by ESC or context limit → SubagentStop not fired → zombie in DB (use Kill button in UI)
- Transcript extraction needs 500ms delay (race condition with file write)
- VSCode Extension 설치 후 반드시 Reload Window 필요 (핫 리로드 미지원)

## Swarm Best Practices
- **Agent sizing**: Keep to 5-7 files per agent to avoid context exhaustion
- **Don't agent trivial tasks**: 3-line changes should be done by Leader directly
- **Reviewer is worth it**: Always catches type safety, stale data, missing error handling
- **True parallelism**: Requires same-message Task calls (separate messages = sequential)
- **clnode's sweet spot**: Multi-step chains where Agent B needs Agent A's results
