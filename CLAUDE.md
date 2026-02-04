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

Using only two features that Claude Code already provides — **hooks** and
**skills** — clnode builds a swarm mode layer on top of vanilla Claude Code:

- **hooks** intercept agent lifecycle events and route context through DuckDB
- **skills** define agent roles, rules, and workflows
- **DuckDB** acts as shared memory between agents (the communication channel)

When Agent B starts, the SubagentStart hook automatically injects Agent A's
results via `additionalContext` — no Leader relay needed. The Leader stays lean,
only making high-level decisions instead of carrying every intermediate result.

**Goal: distribute as an npm plugin** — `clnode init` on any project to enable
swarm capabilities in Claude Code.

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

## How It Works

1. `clnode start` — daemon starts on port 3100
2. `clnode init ./project` — installs hooks + skills into target project
3. Claude Code runs → hooks fire on every agent lifecycle event
4. hook.sh reads JSON from stdin, POSTs to daemon, returns response via stdout
5. DuckDB stores all state (agents, context, files, activities)
6. On SubagentStart: daemon reads previous context from DB → returns `additionalContext`
7. On SubagentStop: daemon saves agent's work summary to DB
8. Leader's context stays clean — DB handles the coordination

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
- **Package Manager**: pnpm

## Hook Protocol (stdin → stdout)
```
Claude Code → stdin(JSON) → hook.sh → curl POST daemon → stdout(JSON) → Claude Code
```

stdin example:
```json
{
  "session_id": "abc123",
  "hook_event_name": "SubagentStart",
  "tool_input": { "subagent_type": "soomin-jeon", "prompt": "..." }
}
```

stdout example (SubagentStart response):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "Previous session summary: product API completed."
  }
}
```

## Directory Structure
```
src/
  cli/index.ts          — CLI entry point (clnode start/stop/init/status/ui)
  hooks/hook.sh         — stdin→stdout hook script (jq + curl)
  server/
    index.ts            — Hono server entry point (port 3100)
    db.ts               — DuckDB connection + schema initialization
    routes/
      hooks.ts          — POST /hooks/:event (7 event handlers + RegisterProject)
      api.ts            — GET /api/* (REST API)
      ws.ts             — WebSocket broadcast utility
    services/
      project.ts        — Project registration
      session.ts        — Session lifecycle
      agent.ts          — Agent lifecycle + context_summary
      context.ts        — Context entries (entry_type, content, tags[])
      filechange.ts     — File change tracking (Edit/Write)
      task.ts           — Task state tracking
      activity.ts       — Activity log (details JSON)
templates/
  hooks-config.json     — Hooks config template (HOOK_SCRIPT_PATH placeholder)
data/                   — DuckDB file storage (gitignored)
```

## DuckDB Schema (7 tables)
- **projects**: id, name, path (UNIQUE), created_at
- **sessions**: id, project_id, started_at, ended_at, status
- **agents**: id, session_id, agent_name, agent_type, parent_agent_id, status, started_at, completed_at, context_summary
- **context_entries**: id(seq), session_id, agent_id, entry_type, content TEXT, tags VARCHAR[], created_at
- **file_changes**: id(seq), session_id, agent_id, file_path, change_type, created_at
- **tasks**: id(seq), project_id, title, description, status, assigned_to, created_at, updated_at
- **activity_log**: id(seq), session_id, agent_id, event_type, details JSON, created_at

## Hook Events (POST /hooks/:event)
| Event | Purpose | Response |
|-------|---------|----------|
| SessionStart | Register session, link to project | {} |
| SubagentStart | Register agent, return additionalContext | { hookSpecificOutput: { additionalContext } } |
| SubagentStop | Finalize agent, store context_summary | {} |
| PostToolUse | Track file changes (Edit/Write) | {} |
| Stop | Log stop event | {} |
| SessionEnd | End session, close all agents | {} |
| UserPromptSubmit | Log user prompt | {} |
| RegisterProject | Register project in DB (used by `clnode init`) | { ok, project_id } |

## Commands
```bash
pnpm dev          # Dev server with tsx
pnpm build        # TypeScript build
pnpm start        # Run built server
pnpm dev:cli      # CLI dev mode
```

## CLI Usage
```bash
clnode start       # Start daemon (background)
clnode stop        # Stop daemon
clnode status      # Show active sessions/agents
clnode init [path] # Install hooks + register project in DB
clnode ui          # Open Web UI in browser
```

## `clnode init` behavior
1. Set hook.sh as executable
2. Read templates/hooks-config.json, replace HOOK_SCRIPT_PATH with absolute path
3. Write hooks config to target project's `.claude/settings.local.json`
4. Register project in DB via POST /hooks/RegisterProject (if daemon running)

## API Endpoints
- `GET /` — Server info
- `GET /ws` — WebSocket real-time events
- `GET /api/health` — Health check
- `GET /api/projects` — All registered projects
- `GET /api/sessions[?active=true]` — Session list
- `GET /api/sessions/:id` — Session detail
- `GET /api/sessions/:id/agents` — Agents by session
- `GET /api/sessions/:id/context` — Context entries by session
- `GET /api/sessions/:id/files` — File changes by session
- `GET /api/sessions/:id/activities` — Activities by session
- `GET /api/agents[?active=true]` — Agent list
- `GET /api/tasks[?project_id=X]` — Task list
- `GET /api/activities[?limit=50]` — Recent activities

## Important Notes
- Use `now()` instead of `current_timestamp` in DuckDB
- hook.sh exits 0 even on failure (never blocks Claude Code)
- hook.sh requires `jq` for JSON parsing
- Server port: env var CLNODE_PORT (default 3100)
- DuckDB VARCHAR[] params need special handling (literal construction, not bind params)

## Phase 1 Status: Complete
- [x] Project init (package.json, tsconfig, .gitignore)
- [x] DuckDB schema (7 tables matching spec)
- [x] Hono server + WebSocket
- [x] Hook event handlers (stdin→stdout protocol)
- [x] **additionalContext injection on SubagentStart**
- [x] **context_summary storage on SubagentStop**
- [x] **file_changes tracking on PostToolUse (Edit/Write)**
- [x] **Project registration via clnode init**
- [x] REST API
- [x] Service layer (7 services)
- [x] hook.sh (jq + curl, stdin→stdout)
- [x] CLI (start/stop/status/init/ui)
- [x] Hook config template with absolute path
- [x] Build verified
- [x] Full integration test passed

## Roadmap

## Phase 2 Status: Complete
- [x] React 19 + Vite 7 + TailwindCSS 4
- [x] Dashboard: stats cards, active sessions, recent activity, WebSocket LIVE
- [x] Agents: agent tree (parent-child), status filter, context summary
- [x] Context: session selector, full-text search (content/type/tags)
- [x] Tasks: 3-column kanban (pending/in_progress/completed)
- [x] Activity: event log + file changes tabs, event type filter, WebSocket live
- [x] Production static serving (Hono serves dist/web + SPA fallback)

## Phase 3 Status: Complete
- [x] **Smart context injection** (`src/server/services/intelligence.ts`)
  - Sibling agent summaries (same parent, same session)
  - Same-type agent history (learn from predecessors)
  - Tagged context entries (agent name/type/all tags)
  - Fallback to recent session context
  - Assigned tasks for the starting agent
- [x] **Cross-session context** — queries previous sessions of the same project
- [x] **Todo Enforcer** — SubagentStop checks incomplete tasks, logs warning to context_entries
- [x] **UserPromptSubmit auto-attach** — returns project context (active agents, open tasks, decisions, completed summaries)

## Phase 4 Status: Complete
- [x] **npm package config** — files, keywords, license, prepublishOnly, bin
- [x] **Error handling** — hook.sh 3s timeout + jq check, hooks.ts error fallback for SubagentStart/UserPromptSubmit, server EADDRINUSE/DuckDB error messages
- [x] **README.md** — Quick Start, architecture, CLI commands, API reference
- [x] **Template skills** — 5 agent role templates (backend-dev, frontend-dev, reviewer, test-writer, architect)
- [x] **`clnode init --with-skills`** — copies skill templates to target project

## Dogfooding Status

clnode has been initialized on itself (`clnode init --with-skills` on this repo).

### What's Done
- [x] `clnode start` — daemon running on port 3100
- [x] `clnode init --with-skills` — hooks + 5 skill templates installed
- [x] Project registered as `clnode` in DuckDB
- [x] First dogfooding run: 3 parallel agents (backend-dev, reviewer, test-writer)
  - backend-dev added `GET /api/stats` endpoint
  - reviewer found intelligence.ts had no query error isolation → fixed with `safeQuery()`
  - test-writer confirmed 100% API client coverage
- [x] Hooks installed in `.claude/settings.local.json`

### What to Verify Next (NEW SESSION REQUIRED)
**Hooks activate on session start.** The current session was started before hooks
were installed, so hooks haven't fired yet. On the next session:

1. Start daemon if not running: `node dist/cli/index.js start`
2. Open a new Claude Code session in this project
3. Spawn subagents via Task tool (e.g., ask for parallel implementation + review)
4. Check if hooks fire:
   - `curl -sf http://localhost:3100/api/sessions` — should show the new session
   - `curl -sf http://localhost:3100/api/agents` — should show spawned agents
   - `curl -sf http://localhost:3100/api/activities?limit=10` — should show events
   - `node dist/cli/index.js status` — should show active session/agents
5. Open Web UI: `node dist/cli/index.js ui` or http://localhost:3100
6. Verify SubagentStart returns `additionalContext` with smart context

### Known Issues from Dogfooding
- Hooks require Claude Code session restart after `clnode init` (documented in README + CLI)
- `intelligence.ts` queries now wrapped in `safeQuery()` for partial success on failure
- SQL injection in tag query fixed (now uses bind params instead of string interpolation)
- `.claude/skills/` and `data/` added to `.gitignore`

## Next Steps

### Skill Rules for Structured Context Entries
Define skill rules that instruct agents to write structured context entries
using specific `entry_type` values:
- **`decision`** — architectural or implementation decisions with rationale
- **`blocker`** — issues that block progress and need resolution
- **`handoff`** — explicit notes for the next agent taking over related work

When agents actively write these entry types, the smart context engine in
`intelligence.ts` can select truly relevant context instead of just recent
summaries. This is where the plugin's value multiplies — agents stop being
isolated workers and start forming a knowledge graph across time and sessions.

### Lessons from the Build Session
This project was built in a single extended Claude Code session (Phase 1→4).
The session itself proved why clnode is needed:

1. Context hit limits during sequential Phase 1→4 implementation
2. Session was cut off and had to continue via summary-based handoff
3. Missing info from summary required re-reading files from scratch

If clnode had been active from the start with each Phase as a subagent:
- Phase 1 agent stop → DB stores "Hono server + DuckDB 7 tables + CLI done"
- Phase 2 agent start → receives Phase 1 results via `additionalContext`
- Session cut → new session recovers everything via cross-session context
- Leader only says "do Phase 2" → context stays minimal

The real test is next session: spawn 3 subagents in parallel from the start,
verify `additionalContext` injection works end-to-end, and confirm the Leader
context stays clean throughout.

### Remaining Work
- Verify hooks fire in a fresh Claude Code session (see checklist above)
- Add `GET /api/stats` to web API client and Dashboard page
- npm publish dry-run (`npm pack` to verify package contents)
- Consider adding `clnode logs` CLI command for daemon log tailing
