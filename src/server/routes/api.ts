import { Hono } from "hono";
import { getAllSessions, getActiveSessions, getSession } from "../services/session.js";
import { getAllAgents, getActiveAgents, getAgentsBySession } from "../services/agent.js";
import { getTasksBySession } from "../services/task.js";
import { getRecentActivities, getActivitiesBySession } from "../services/activity.js";
import { getRecentEvents, getEventsBySession } from "../services/event.js";
import { getToolUsesBySession, getRecentToolUses } from "../services/tooluse.js";

const api = new Hono();

// 세션
api.get("/sessions", async (c) => {
  const active = c.req.query("active");
  const sessions = active === "true" ? await getActiveSessions() : await getAllSessions();
  return c.json(sessions);
});

api.get("/sessions/:id", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "not found" }, 404);
  return c.json(session);
});

api.get("/sessions/:id/agents", async (c) => {
  return c.json(await getAgentsBySession(c.req.param("id")));
});

api.get("/sessions/:id/tasks", async (c) => {
  return c.json(await getTasksBySession(c.req.param("id")));
});

api.get("/sessions/:id/activities", async (c) => {
  return c.json(await getActivitiesBySession(c.req.param("id")));
});

api.get("/sessions/:id/events", async (c) => {
  return c.json(await getEventsBySession(c.req.param("id")));
});

api.get("/sessions/:id/tools", async (c) => {
  return c.json(await getToolUsesBySession(c.req.param("id")));
});

// 에이전트
api.get("/agents", async (c) => {
  const active = c.req.query("active");
  const agents = active === "true" ? await getActiveAgents() : await getAllAgents();
  return c.json(agents);
});

// 활동 로그
api.get("/activities", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  return c.json(await getRecentActivities(limit));
});

// 이벤트
api.get("/events", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "100", 10);
  return c.json(await getRecentEvents(limit));
});

// 도구 사용
api.get("/tools", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  return c.json(await getRecentToolUses(limit));
});

// 헬스체크
api.get("/health", (c) => {
  return c.json({ status: "ok", uptime: process.uptime() });
});

export default api;
