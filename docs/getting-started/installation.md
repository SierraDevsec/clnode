---
title: Installation
layout: default
parent: Getting Started
nav_order: 1
---

# Installation

## Prerequisites

| Item | Minimum Version | Installation |
|------|----------------|--------------|
| **Node.js** | v22+ | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **jq** | any | `brew install jq` (macOS) / `apt install jq` (Ubuntu) |
| **curl** | any | Pre-installed on most systems |

## Install

### For Claude Code Users

Ask Claude Code:
```
curl -s https://raw.githubusercontent.com/SierraDevsec/clnode/main/docs/installation.md
```

### Quick Install

```bash
npx clnode init .
```

This installs:
- **Hooks** in `.claude/settings.local.json`
- **Agents**: `clnode-reviewer` (code review) + `clnode-curator` (knowledge curation)
- **Skills**: `compress-output`, `compress-review`, `clnode-agents`
- **Rules**: `team.md` (swarm workflow)
- **Agent Memory**: Seed `MEMORY.md` files for agents

### For Development

```bash
git clone https://github.com/SierraDevsec/clnode.git
cd clnode && pnpm install && pnpm build
node dist/cli/index.js start
```

## Post-Install

**Restart your Claude Code session** — hooks activate on session start.

Verify installation:
```bash
npx clnode status
```

Open the dashboard:
```bash
npx clnode ui
```
