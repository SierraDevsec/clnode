# clnode Installation Guide

> Swarm intelligence plugin for Claude Code multi-agent collaboration

## For LLM Agents

Execute the instructions in this guide step by step.

### Step 1: Ask User for Installation Type

Ask the user:
```
clnode 설치 옵션을 선택하세요:
1. 기본 설치 (reviewer, worker 에이전트) - "기본" 또는 "1"
2. 전체 설치 (추가 에이전트 포함) - "전체" 또는 "2"
3. 포트 지정 필요시 포트 번호도 알려주세요 (기본: 3100)
```

### Step 2: Run Installation

**Default installation** (user says "기본", "1", "default"):
```bash
npx clnode init .
```

**Full installation** (user says "전체", "2", "full", or wants all agents):
```bash
npx clnode init . --with-agents
```

**Custom port** (user specifies port number):
```bash
npx clnode init . --port 3101
# or with full agents:
npx clnode init . --with-agents --port 3101
```

### Step 3: Verify Installation

Success if you see:
```
[clnode] Setup complete!
[clnode] Restart your Claude Code session to activate hooks.
```

### Step 4: Session Restart Notice

Tell the user:
"Installation complete! To activate hooks, exit the current session and restart. Use `/exit` or ESC to exit, then run `claude` again."

### Step 5: Post-Restart Verification

After restart, when user enters a prompt, the system message should show:
```
[clnode project context]
...
```

If this message appears, clnode is working correctly.

---

## Installed Templates

### Default Installation (for all projects)

**Agents (`.claude/agents/`)**
| Agent | Role |
|-------|------|
| reviewer | Code review (universal) |
| worker | General-purpose worker |

**Skills (`.claude/skills/`)**
| Skill | Purpose |
|-------|---------|
| compress-context | Compress long agent context |
| session-usage | Session token usage analysis |
| clnode-agents | Custom agent creation guide |

**Rules (`.claude/rules/`)**
| Rule | Content |
|------|---------|
| clnode-usage.md | clnode usage, context compression rules |

### --with-agents Option (additional agents)

**Additional Agents**
| Agent | Role |
|-------|------|
| architect | Architecture design |
| backend-dev | Backend development |
| frontend-dev | Frontend development |
| test-writer | Test writing |

**Additional Rules**
| Rule | Content |
|------|---------|
| team.md | Team workflow, review protocol |
| nodejs.md, react.md, typescript.md | Coding style rules |
| swarm-context.md | Swarm context management |

---

## Additional Commands

```bash
# Check status
npx clnode status

# Open Web UI
npx clnode ui

# View logs
npx clnode logs -f

# Stop daemon
npx clnode stop
```

---

## Troubleshooting

### Hooks not working
1. Verify Claude Code session was restarted
2. Check daemon is running: `npx clnode status`
3. Verify hooks config exists in `.claude/settings.local.json`

### DuckDB Error
```bash
cd ~/.npm/_npx/.../node_modules/clnode
npm rebuild duckdb
```

### jq not found Error
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq
```
