# clnode User Guide

> [English README](../README.md) | [한국어 README](../README.ko.md) | [한국어 가이드](./GUIDE.md)

A plugin that solves the context explosion problem when running multi-agent mode in Claude Code — where agents can't pass results to each other and everything piles up on the Leader.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Starting the Daemon](#starting-the-daemon)
4. [Project Initialization (clnode init)](#project-initialization)
5. [Understanding Agents, Skills, and Rules](#understanding-agents-skills-and-rules)
6. [Creating Custom Agents](#creating-custom-agents)
7. [Using with Claude Code](#using-with-claude-code)
8. [Web UI Dashboard](#web-ui-dashboard)
9. [CLI Commands](#cli-commands)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Item | Minimum Version | Installation |
|------|----------------|--------------|
| **Node.js** | v22 or higher | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **pnpm** | v10 or higher | `npm install -g pnpm` |
| **jq** | any | `brew install jq` (macOS) / `apt install jq` (Ubuntu) |
| **Claude Code** | latest | [claude.com/claude-code](https://claude.com/claude-code) |

`jq` and `curl` are used by hook.sh for JSON parsing and HTTP calls. curl is pre-installed on most systems.

---

## Installation

Run this command in Claude Code:

```
curl -s https://raw.githubusercontent.com/SierraDevsec/clnode/main/docs/installation.md
```

Claude will read the guide and install clnode automatically.

### Manual Installation

If automatic installation doesn't work:

```bash
# In your project directory
npx clnode init .

# Open dashboard
npx clnode ui
```

> For developer installation (git clone), see [README](../README.md#for-development).

---

## Starting the Daemon

clnode runs as a background daemon, independent of Claude Code sessions.

```bash
clnode start
# [clnode] Daemon started (PID: 12345, Port: 3100)
```

Default port is **3100**. To change it:

```bash
clnode start --port 3200
# or
CLNODE_PORT=3200 clnode start
```

Check daemon status:

```bash
clnode status
# Active sessions: 0
# Active agents: 0
```

Stop the daemon:

```bash
clnode stop
# [clnode] Daemon stopped
```

---

## Project Initialization

`clnode init` installs Claude Code hooks into the target project.

### Basic Initialization

```bash
clnode init /path/to/your/project
```

What this command does:
1. Sets execute permission on `hook.sh`
2. Reads `templates/hooks-config.json` and replaces with absolute path to hook.sh
3. Writes hooks config to `.claude/settings.local.json` in the target project
4. Registers the project in DB if daemon is running

### Initialization with Skill Templates

```bash
clnode init /path/to/your/project --with-skills
```

Copies agents, skills, and rules from the `templates/` directory to the project's `.claude/` directory.

**Files copied:**
```
.claude/
├── agents/           # Agent definitions (5)
│   ├── backend-dev.md
│   ├── frontend-dev.md
│   ├── reviewer.md
│   ├── test-writer.md
│   └── architect.md
├── skills/           # User-invoked skills (2)
│   ├── compress-context/SKILL.md
│   └── usage/SKILL.md
└── rules/            # Auto-load rules (5)
    ├── team.md
    ├── typescript.md
    ├── react.md
    ├── nodejs.md
    └── swarm-context.md
```

### After Initialization

**Restart your Claude Code session.** Hooks are loaded at session start, so you must restart the session after `clnode init` for hooks to activate.

---

## Understanding Agents, Skills, and Rules

Claude Code supports three types of configuration files, each with different roles:

### Concept Comparison

| File Location | Role | When Loaded | Content |
|--------------|------|-------------|---------|
| `.claude/agents/*.md` | **Agent Definition** | When creating agent via Task tool | Metadata (name, tools, model) + basic instructions |
| `.claude/skills/*/SKILL.md` | **User-invoked Skills** | When `/skill-name` command is called | Commands like `/usage`, `/compress-context` |
| `.claude/rules/*.md` | **Auto Rules** | Auto-loaded in every conversation | Project-wide rules, conventions, constraints |

### Differences by Example

```
┌─────────────────────────┬─────────────────────────┬────────────────────────────────────────┐
│ File                    │ Role                    │ Example Content                        │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────────┤
│ rules/typescript.md     │ Auto-load rules         │ strict mode, import order, naming      │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────────┤
│ skills/usage/SKILL.md   │ User-invoked skill      │ /usage command for token analytics     │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────────┤
│ agents/backend-dev.md   │ Agent definition        │ Backend agent role, responsibilities   │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────────┘
```

### When to Use What?

- **rules**: Rules that should always apply to every conversation (code style, project conventions)
- **skills**: Commands invoked via `/skill-name` (e.g., `/usage`, `/compress-context`)
- **agents**: Definitions for agents created via the Task tool in multi-agent mode

### clnode-Provided Templates

| Agent | Role | Recommended Model |
|-------|------|-------------------|
| `backend-dev` | API, DB, business logic | Sonnet |
| `frontend-dev` | UI components, state management | Sonnet |
| `reviewer` | Code review, quality checks | Opus |
| `test-writer` | Writing tests | Sonnet |
| `architect` | Design, decision-making | Opus |

---

## Creating Custom Agents

You can create custom agents tailored to your project.

### 1. Create Agent Definition

`.claude/agents/my-agent.md`:

```markdown
---
name: my-agent
description: Project-specific agent description
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You are an agent responsible for [role].

## Responsibilities
- First responsibility
- Second responsibility

## Guidelines
- Follow existing patterns
- Write type-safe code

## On Completion
Provide a summary of:
1. What was created
2. Which files were modified
3. Known limitations
```

### 2. (Optional) Add User-Invoked Skill

Create a skill that can be invoked via `/skill-name` in `.claude/skills/my-skill/SKILL.md`.

Skills must include YAML frontmatter:
```yaml
---
name: my-skill
description: Skill description (helps Claude decide when to use it)
version: 1.0.0
---
```

### 3. (Optional) Add Project Rules

Write rules that all agents should follow in `.claude/rules/my-rule.md`.

### Using Existing Project Files

**If your project already has `.claude/agents/`, `.claude/skills/`, or `.claude/rules/` directories**, `clnode init --with-skills` will NOT overwrite existing files — it only copies missing files.

You can maintain your own agent configuration while supplementing with clnode's default templates.

---

## Using with Claude Code

After initialization, **everything works automatically** without additional configuration.

### What Happens Automatically

| Event | Action |
|-------|--------|
| **Session Start** | Session registered in DB, linked to project |
| **Agent Start** (SubagentStart) | Agent registered in DB, previous agents' results injected via `additionalContext` |
| **Agent Stop** (SubagentStop) | Agent's work summary extracted from transcript and saved to DB |
| **Tool Use** (PostToolUse) | File changes (Edit/Write) tracked, logged to activity |
| **User Prompt** (UserPromptSubmit) | Project context (active agents, open tasks, recent decisions) auto-attached |

### Smart Context Injection

Context automatically injected when a new agent starts:

- **Sibling Agent Summaries** — What other agents under the same parent did
- **Same-Type History** — What previous agents of the same type did
- **Cross-Session Context** — Summaries from previous sessions on the same project
- **Tagged Context** — Entries tagged for specific agents
- **Assigned Tasks** — Incomplete tasks assigned to this agent

### Example Workflow

```
User: "Add authentication to the API server"

Leader (Opus):
  ├── backend-dev (Sonnet): auth middleware + JWT implementation
  │     → Summary saved to DB on completion
  ├── test-writer (Sonnet): Write tests
  │     → Receives backend-dev's summary on start
  └── reviewer (Opus): Code review
        → Receives backend-dev + test-writer summaries on start
```

The Leader doesn't need to relay intermediate results. The DB handles it.

---

## Web UI Dashboard

```bash
clnode ui
# Automatically opens http://localhost:3100 in browser
```

Or navigate directly to `http://localhost:3100`.

### Dashboard

Shows overall stats for sessions, agents, context, file changes at a glance. Real-time updates via WebSocket.

![Dashboard](screenshots/01-dashboard.png)

### Agents

Shows agent tree by session. Click an agent to expand details (summary, context, file changes). Zombie agents can be cleaned up with the **Kill** button.

![Agents](screenshots/02-agents.png)

### Context Store

Browse context entries saved by agents, organized by session. Search by content, type, or tags. This is the actual inter-agent communication.

![Context](screenshots/03-context.png)

### Tasks (Kanban)

5-stage kanban board: **Idea → Planned → Pending → In Progress → Completed**. Drag-and-drop cards or use arrow buttons to move them. Add color tags and comments.

**Register Tasks**: Register via natural language in Claude Code, or directly via the **+ Add** button in the Web UI.

```
User: "Register 'Add authentication' as a task"
→ Claude calls clnode API to create task card
```

**Execute Tasks**: Tell Claude Code to work on registered tasks.

```
User: "Work on the 'Add authentication' task from the kanban board"
→ Claude creates an agent to start work
→ Task is auto-assigned to agent on start, included in additionalContext
→ Task status automatically changes to Completed when done
```

You can also manually change status by dragging cards or using arrow buttons in the Web UI kanban board.

![Tasks](screenshots/04-tasks.png)

### Activity

Real-time log of all hook events. Filter by event type, agent-only view, and file changes tab.

![Activity](screenshots/05-activity.png)

### Project Filter

Select a project from the dropdown at the bottom of the sidebar to filter all pages to show only that project's data.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `clnode start` | Start daemon (background, default port 3100) |
| `clnode start --port 3200` | Start with custom port |
| `clnode stop` | Stop daemon |
| `clnode status` | Show active sessions and agent counts |
| `clnode init [path]` | Install hooks + register project in DB |
| `clnode init [path] --with-skills` | hooks + copy agents/skills/rules templates |
| `clnode ui` | Open Web UI in browser |
| `clnode logs` | View daemon logs |
| `clnode logs -f` | Follow daemon logs in real-time |
| `clnode logs -n 100` | View last 100 lines of logs |

Environment Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLNODE_PORT` | `3100` | Daemon port |

---

## Troubleshooting

### Hooks aren't working

Make sure you **restarted your Claude Code session** after `clnode init`. Hooks are only loaded at session start.

### Daemon won't start

The port might already be in use:

```bash
lsof -i :3100
# If a process shows up, kill it or use a different port
clnode start --port 3200
```

### Zombie agents stuck in "active" state

If an agent terminates abnormally, SubagentStop hook doesn't fire and the agent remains in active state in DB.

- **Web UI**: Click the **Kill** button on the Agents page
- **API**: `curl -X PATCH http://localhost:3100/api/agents/{id} -H "Content-Type: application/json" -d '{"status":"completed"}'`

### context_summary is null

This is normal. Claude Code doesn't send summary directly in the SubagentStop event. clnode reads the agent's transcript file (JSONL) and extracts the last assistant message. If the agent is killed mid-execution, the transcript may be incomplete.

### "jq not found" error

hook.sh uses jq for JSON parsing:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Verify
jq --version
```

### Changes to code aren't reflected

After code changes, you need to rebuild + restart the daemon:

```bash
pnpm build
clnode stop && clnode start
```
