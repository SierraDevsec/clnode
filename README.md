# clnode

**Claude Code Swarm Intelligence Plugin** — your own dev team, running 24/7.

One solo developer can work like a 5-person team. Backend, frontend, reviewer, and tester agents run in parallel, automatically passing results to each other. `clnode init` is all it takes.

## Why clnode?

Claude Code already supports multi-agent mode — but agents **cannot communicate with each other**. Every result, every review cycle, every handoff must flow through the Leader agent. Its context explodes. It loses track. The whole system grinds to a halt.

clnode fixes this using only two features Claude Code already provides — **hooks** and **skills** — to build a swarm layer on top of vanilla Claude Code. No custom framework. No wrapper. Just a plugin that fills the exact gap in the existing system.

```
Agent A finishes → saves summary to DB
Agent B starts   → receives A's summary via additionalContext
Leader           → stays lean, only makes high-level decisions
```

### What makes this work

- **`additionalContext` injection** via the official hook protocol — not a hack, a proper extension
- **DuckDB as an agent mailbox** — agents don't talk directly, they talk through time
- **Leader context stays clean** — the #1 bottleneck in multi-agent systems, solved by externalizing coordination state to DB

## Quick Start

```bash
# 1. Install
npm install -g clnode

# 2. Start the daemon
clnode start

# 3. Initialize your project
cd your-project
clnode init

# 4. Open Web UI
clnode ui
```

That's it. Claude Code will now automatically coordinate agents through clnode.

## How It Works

```
Claude Code Session
│
├── Agent A starts  ──→  hook.sh  ──→  clnode daemon  ──→  DuckDB
├── Agent A stops   ──→  hook.sh  ──→  clnode daemon  ──→  DuckDB (save summary)
├── Agent B starts  ──→  hook.sh  ──→  clnode daemon  ──→  DuckDB (read A's summary)
│                                          │
│                                          └──→  stdout: additionalContext
│                                                (A's results injected into B)
└── Leader only sees final reports — context stays minimal
```

1. **hooks** intercept agent lifecycle events (start, stop, tool use, etc.)
2. **hook.sh** reads JSON from stdin, POSTs to the daemon, returns response via stdout
3. **DuckDB** acts as shared memory between agents
4. On `SubagentStart`: daemon returns previous agents' context via `additionalContext`
5. On `SubagentStop`: daemon saves the agent's work summary

**Agents talk through time, not directly.** Agent A leaves a summary in DB. Agent B starts later and receives it automatically.

## Smart Context Injection (Phase 3)

clnode doesn't just return recent context — it selects **relevant** context:

- **Sibling summaries**: Results from other agents under the same parent
- **Same-type history**: What previous agents of the same role accomplished
- **Cross-session context**: Summaries from previous Claude Code sessions on the same project
- **Tagged context**: Entries explicitly tagged for a specific agent
- **Todo Enforcer**: Warns when agents stop with incomplete tasks
- **Prompt auto-attach**: User prompts automatically receive project context (active agents, open tasks, recent decisions)

## CLI Commands

| Command | Description |
|---------|-------------|
| `clnode start` | Start the daemon (default port 3100) |
| `clnode stop` | Stop the daemon |
| `clnode status` | Show active sessions and agents |
| `clnode init [path]` | Install hooks into a project |
| `clnode ui` | Open Web UI in browser |

### Options

```bash
clnode start --port 3200    # Custom port
CLNODE_PORT=3200 clnode start  # Via env var
```

## Web UI

Built-in dashboard at `http://localhost:3100`:

- **Dashboard** — Active sessions, agent count, recent activity timeline
- **Agents** — Agent tree (parent-child hierarchy), status filter
- **Context** — Full-text search across context entries, tags
- **Tasks** — Kanban board (pending → in progress → completed)
- **Activity** — Real-time event log via WebSocket

## Requirements

- **Node.js** >= 22
- **jq** — for hook.sh JSON parsing (`brew install jq` / `apt install jq`)
- **curl** — for hook.sh HTTP calls (pre-installed on most systems)

## Project Structure

```
src/
  cli/index.ts              CLI entry point
  hooks/hook.sh             stdin→stdout hook script
  server/
    index.ts                Hono server (port 3100)
    db.ts                   DuckDB schema (7 tables)
    routes/
      hooks.ts              POST /hooks/:event
      api.ts                GET /api/*
      ws.ts                 WebSocket broadcast
    services/
      intelligence.ts       Smart context injection + Todo Enforcer
      agent.ts, session.ts, context.ts, ...
  web/                      React 19 + TailwindCSS 4 SPA
templates/
  hooks-config.json         Hook config template
  skills/                   Agent role templates
```

## API

| Endpoint | Description |
|----------|-------------|
| `POST /hooks/:event` | Hook event handler |
| `GET /api/health` | Health check |
| `GET /api/sessions` | Session list |
| `GET /api/agents` | Agent list |
| `GET /api/tasks` | Task list |
| `GET /api/activities` | Activity log |
| `GET /ws` | WebSocket real-time events |

## License

MIT
