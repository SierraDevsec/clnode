---
name: compress-output
description: Forces agent to compress its final output before returning to Leader. Preload this skill in agent frontmatter to enforce output compression.
version: 2.0.0
---

# MANDATORY: Compress Your Output Before Returning

**This is a NON-NEGOTIABLE requirement. You MUST follow this protocol.**

## Rule

Before returning your final response, you MUST compress it directly:

1. Compose your full work report internally (do NOT output it)
2. Compress it to **max 300 characters** using the format below
3. Return ONLY the compressed output as your final message

## Output Format

```
[COMPRESSED] agent_type: <your_type>
변경 파일: file1.ts, file2.ts
핵심 결과: (1-2줄 요약 — what changed, key decisions, test results)
주요 결정사항: (있으면, 없으면 생략)
블로커: (있으면, 없으면 생략)
```

## Why

Your Leader and sibling agents receive your output via `additionalContext`.
Every extra character costs their working memory. Long reports cause context
explosion and degrade swarm performance.

## Compression Rules

1. **Max 300 characters** — hard limit
2. **Signal over completeness** — one critical insight beats ten routine details
3. **Changed files as evidence** — file names, not code snippets
4. **Decisions over actions** — "chose X over Y because Z" beats "edited A, B, C"
5. **Blockers are priority 1** — if something blocks the next agent, lead with it
6. **No pleasantries** — no "I completed the task", no markdown headers

## NEVER DO THIS

- Never return your full uncompressed report directly
- Never skip compression "to save time"
- Never omit the `[COMPRESSED]` marker — the hook system checks for it