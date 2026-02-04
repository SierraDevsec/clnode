# clnode

[한국어](./README.ko.md) | [사용 가이드 (한국어, 스크린샷 포함)](./docs/GUIDE.md)

**Claude Code Swarm Intelligence Plugin** — your own dev team, running 24/7.

One solo developer can work like a 5-person team. Backend, frontend, reviewer, and tester agents run in parallel, automatically passing results to each other.

No API keys. No extra model costs. No configuration. Just `clnode init`.

## The Problem

We were using Claude Code's multi-agent mode on a real project — a Leader agent delegating to backend, frontend, and reviewer agents in parallel.

It worked great at first. Then the reviewer found issues.

The reviewer's feedback had to go back to the Leader. The Leader re-assigned the work. The implementer fixed it. The result went back through the Leader. The reviewer checked again. Failed again. Back to the Leader.

**Every round-trip piled context onto the Leader.** After a few review cycles, the Leader's context window was full. It started losing track of what was done, what was pending, and what failed. The whole session collapsed.

The root cause was simple: **agents cannot talk to each other.** Everything must flow through the Leader, and the Leader becomes the bottleneck.

## The Solution

We noticed Claude Code already provides two features — **hooks** (lifecycle event interceptors) and **skills** (agent role definitions). Hooks can inject `additionalContext` into agents via stdout. That's all we needed.

clnode uses hooks to intercept agent lifecycle events and DuckDB as shared memory. When Agent A finishes, its summary goes to DB. When Agent B starts, it receives A's summary automatically — no Leader relay needed.

No custom framework. No wrapper. Just a plugin that fills the exact gap in the existing system.

```
Agent A finishes → saves summary to DB
Agent B starts   → receives A's summary via additionalContext
Leader           → stays lean, only makes high-level decisions
```

### What makes this work

- **`additionalContext` injection via the official hook protocol** — Claude Code's `SubagentStart` hook allows returning `additionalContext` in stdout. clnode uses this to inject previous agents' results into new agents. Not a hack — a proper extension of the documented protocol.
- **DuckDB as an agent mailbox** — agents don't talk to each other directly. Agent A finishes and leaves a summary in DB. Agent B starts later and receives it automatically. They communicate through time, not through the Leader.
- **Leader context stays clean** — in vanilla Claude Code, every review cycle ("review failed → tell Leader → Leader re-assigns → implementer fixes → send back") piles context onto the Leader until it hits limits. clnode externalizes this coordination state to DB, so the Leader only makes high-level decisions.
- **Zero lock-in** — clnode uses only hooks and skills, both official Claude Code features. Remove the plugin and your project works exactly as before.

## Quick Start

```bash
# 1. Clone & Build
git clone https://github.com/SierraDevsec/clnode.git
cd clnode && pnpm install && pnpm build

# 2. (Optional) Global link
pnpm link --global

# 3. Start the daemon
clnode start

# 4. Initialize your project
clnode init /path/to/your/project

# 5. Open Web UI
clnode ui
```

That's it. **Restart your Claude Code session** — hooks activate on session start. Claude Code will now automatically coordinate agents through clnode.

> For detailed installation and usage instructions with screenshots, see the **[User Guide (Korean)](./docs/GUIDE.md)**.

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

Source Available — free for non-commercial use. Commercial use requires a license. See [LICENSE](./LICENSE) for details.
