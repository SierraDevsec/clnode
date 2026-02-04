# Swarm Context Rules

## Structured Context Entries

When working in swarm mode (clnode enabled), agents should record important context entries
via the clnode daemon API. This enables cross-agent communication through the shared DB.

### Entry Types

| Type | When to Use | Example |
|------|------------|---------|
| `decision` | Architecture/design choice made | "Chose JWT over sessions for auth" |
| `blocker` | Problem that blocks progress | "DuckDB WAL corruption on ALTER TABLE" |
| `handoff` | Work that another agent should pick up | "API ready, frontend needs to integrate /api/tasks" |

### How to Record

Use `curl` to POST context entries to the daemon:

```bash
curl -s -X POST http://localhost:3100/hooks/PostContext \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id": "$SESSION_ID",
    "agent_id": "$AGENT_ID",
    "entry_type": "decision",
    "content": "Using RETURNING clause instead of lastval() for DuckDB inserts",
    "tags": ["backend", "duckdb"]
  }'
```

### When to Record

- **decision**: After making a non-obvious technical choice. Don't record trivial decisions.
- **blocker**: When you encounter something that prevents completion. Include what you tried.
- **handoff**: When your work produces output that another agent needs. Describe what's ready and what's expected next.

### Guidelines

- Keep entries concise (1-2 sentences)
- Include relevant tags for discoverability
- Don't duplicate information that's already in the commit message
- `decision` and `blocker` entries persist across sessions via cross-session context
