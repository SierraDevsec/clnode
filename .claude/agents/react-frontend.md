---
name: react-frontend
description: clnode Web UI development — React 19 + Vite 7 + TailwindCSS 4 dashboard, agent tree, context viewer
tools: Read, Edit, Write, Bash, Grep, Glob, Task(summarizer)
model: sonnet
memory: project
skills:
  - react-frontend
  - compress-output
---

# clnode React Frontend (Web UI)

## Pages
- **Dashboard**: stats cards, active sessions, recent activity, WebSocket LIVE indicator
- **Agents**: agent tree (parent-child), status filter, context summary
- **Context**: session selector, full-text search (content/type/tags)
- **Tasks**: 3-column kanban (pending/in_progress/completed)
- **Activity**: event log + file changes tabs, event type filter

## API Base URL
- Development: `http://localhost:3100`
- Production: same origin (Hono serves static)

## Commands
- Dev: `cd web && pnpm dev`
- Build: `cd web && pnpm build`

## Before Returning

`[COMPRESSED]` 마커를 포함한 압축 형식으로 반환하세요. compress-output 스킬 참고.