# Agent Creation Guide

Use this skill when you want to create custom agents.

## Agent File Structure

Agents are defined as markdown files in `.claude/agents/` folder:

```
.claude/
  agents/
    my-agent.md
```

## Agent Template

```markdown
# Agent Name

Role description

## Responsibilities
- Responsibility 1
- Responsibility 2

## Tools Available
- Read, Write, Edit (file operations)
- Bash (command execution)
- Grep, Glob (search)

## Output Format
How to format the results

## Output Compression
Add `skills: [compress-output]` to agent frontmatter for automatic output compression.
```

## Using Agents

Spawn agents using the Task tool in Claude Code:

```
Use Task tool to run my-agent agent for [task description]
```

## Built-in Agents

### Default Installation
- `reviewer` - Code review, quality checks, security verification
- `worker` - General-purpose worker, file creation/modification/deletion

### With --with-agents Option
- `architect` - Architecture design
- `backend-dev` - Backend development
- `frontend-dev` - Frontend development
- `test-writer` - Test writing

## Agent Model Selection

- `opus` - Complex decisions, architecture choices
- `sonnet` - General implementation tasks (default)
- `haiku` - Simple/repetitive tasks

## Reference

Claude Code official agent documentation:
https://docs.anthropic.com/en/docs/claude-code/agents
