# clnode Usage Rules

clnode is a swarm intelligence plugin for Claude Code multi-agent collaboration.
It provides agent context sharing, task management, and session tracking.

## Agent Setup

Default installation includes `reviewer` and `worker` agents.

For additional agents:
- **More agents**: `npx clnode init . --with-agents` (architect, backend-dev, etc.)
- **Custom agent creation**: Use `/clnode-agents` skill

## Context Compression (Automatic)

Agent output compression is handled automatically via the `compress-output` skill (preloaded in agent frontmatter). Agents self-compress to 10-line `[COMPRESSED]` format before returning results. The `force-compress.sh` hook enforces this as a safety net.

No manual intervention needed — compression is built into the agent lifecycle.

## Web UI

Real-time monitoring available at clnode Web UI:
- Dashboard: Active sessions, agents, token usage
- Agents: Agent tree and status
- Tasks: Task kanban board
- Context: Context entry list
- Activity: Event log

```
http://localhost:3100
```

## Task Management

clnode manages tasks in 6-stage kanban:

```
Idea → Planned → Pending → In Progress → Needs Review → Completed
```

### Agent-Task Integration
- SubagentStart: Auto-assigns pending tasks to in_progress
- SubagentStop: Auto-completes in_progress tasks

### Manual Task Operations (when needed)
Manage via Web UI or API:
```bash
# List tasks
curl http://localhost:3100/api/tasks

# Create task
curl -X POST http://localhost:3100/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Task title", "description": "Description"}'
```

## Context Sharing

When an agent stops, context_summary is automatically saved to DB.
When the next agent starts, previous agents' results are auto-injected.

### Manual Context Addition (when needed)
```bash
curl -X POST http://localhost:3100/hooks/PostContext \
  -H "Content-Type: application/json" \
  -d '{"session_id": "...", "entry_type": "decision", "content": "Decision content"}'
```

entry_type options:
- `decision`: Architecture/technical decisions
- `blocker`: Blocking issues
- `note`: General notes
- `agent_summary`: Agent result summary

## Agent Collaboration

### Leader Responsibilities
- Plan overall task distribution before spawning agents
- Summarize agent results to user (don't relay full output)
- Coordinate rework based on review results

### Agent Responsibilities
- Report results concisely: **changed files + key decisions only**
- Output compression is automatic via compress-output skill
- Report blockers immediately
