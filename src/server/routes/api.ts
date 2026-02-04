import { Hono } from "hono";
import { getAllSessions, getActiveSessions, getSession, getTotalSessionsCount, getActiveSessionsCount } from "../services/session.js";
import { getAllAgents, getActiveAgents, getAgentsBySession, getTotalAgentsCount, getActiveAgentsCount } from "../services/agent.js";
import { getContextBySession, getTotalContextEntriesCount } from "../services/context.js";
import { getFileChangesBySession, getTotalFileChangesCount } from "../services/filechange.js";
import { getAllTasks, getTasksByProject } from "../services/task.js";
import { getRecentActivities, getActivitiesBySession } from "../services/activity.js";
import { getAllProjects } from "../services/project.js";

const api = new Hono();

api.get("/health", (c) => c.json({ status: "ok", uptime: process.uptime() }));

api.get("/projects", async (c) => c.json(await getAllProjects()));

api.get("/sessions", async (c) => {
  const active = c.req.query("active");
  return c.json(active === "true" ? await getActiveSessions() : await getAllSessions());
});

api.get("/sessions/:id", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "not found" }, 404);
  return c.json(session);
});

api.get("/sessions/:id/agents", async (c) => c.json(await getAgentsBySession(c.req.param("id"))));
api.get("/sessions/:id/context", async (c) => c.json(await getContextBySession(c.req.param("id"))));
api.get("/sessions/:id/files", async (c) => c.json(await getFileChangesBySession(c.req.param("id"))));
api.get("/sessions/:id/activities", async (c) => c.json(await getActivitiesBySession(c.req.param("id"))));

api.get("/agents", async (c) => {
  const active = c.req.query("active");
  return c.json(active === "true" ? await getActiveAgents() : await getAllAgents());
});

api.get("/tasks", async (c) => {
  const projectId = c.req.query("project_id");
  return c.json(projectId ? await getTasksByProject(projectId) : await getAllTasks());
});

api.get("/activities", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  return c.json(await getRecentActivities(limit));
});

api.get("/stats", async (c) => {
  const [
    total_sessions,
    active_sessions,
    total_agents,
    active_agents,
    total_context_entries,
    total_file_changes
  ] = await Promise.all([
    getTotalSessionsCount(),
    getActiveSessionsCount(),
    getTotalAgentsCount(),
    getActiveAgentsCount(),
    getTotalContextEntriesCount(),
    getTotalFileChangesCount()
  ]);

  return c.json({
    total_sessions,
    active_sessions,
    total_agents,
    active_agents,
    total_context_entries,
    total_file_changes
  });
});

export default api;
