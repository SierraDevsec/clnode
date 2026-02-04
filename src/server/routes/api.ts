import { Hono } from "hono";
import { getAllSessions, getActiveSessions, getSession, getTotalSessionsCount, getActiveSessionsCount } from "../services/session.js";
import { getAllAgents, getActiveAgents, getAgentsBySession, getAgent, getTotalAgentsCount, getActiveAgentsCount, deleteAgent } from "../services/agent.js";
import { getContextBySession, getContextByAgent, getTotalContextEntriesCount, deleteContextByType } from "../services/context.js";
import { getFileChangesBySession, getFileChangesByAgent, getTotalFileChangesCount } from "../services/filechange.js";
import { getAllTasks, getTasksByProject, getTask, createTask, updateTask, deleteTask } from "../services/task.js";
import { addComment, getCommentsByTask } from "../services/comment.js";
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
api.delete("/sessions/:id/context", async (c) => {
  const entryType = c.req.query("entry_type");
  if (!entryType) return c.json({ error: "entry_type query param required" }, 400);
  const deleted = await deleteContextByType(c.req.param("id"), entryType);
  return c.json({ ok: true, deleted });
});
api.get("/sessions/:id/files", async (c) => c.json(await getFileChangesBySession(c.req.param("id"))));
api.get("/sessions/:id/activities", async (c) => c.json(await getActivitiesBySession(c.req.param("id"))));

api.get("/agents", async (c) => {
  const active = c.req.query("active");
  return c.json(active === "true" ? await getActiveAgents() : await getAllAgents());
});

api.get("/agents/:id", async (c) => {
  const agent = await getAgent(c.req.param("id"));
  if (!agent) return c.json({ error: "not found" }, 404);
  return c.json(agent);
});

api.get("/agents/:id/context", async (c) => {
  return c.json(await getContextByAgent(c.req.param("id")));
});

api.get("/agents/:id/files", async (c) => {
  return c.json(await getFileChangesByAgent(c.req.param("id")));
});

api.delete("/agents/:id", async (c) => {
  await deleteAgent(c.req.param("id"));
  return c.json({ ok: true });
});

api.get("/tasks", async (c) => {
  const projectId = c.req.query("project_id");
  return c.json(projectId ? await getTasksByProject(projectId) : await getAllTasks());
});

api.get("/tasks/:id", async (c) => {
  const task = await getTask(parseInt(c.req.param("id"), 10));
  if (!task) return c.json({ error: "not found" }, 404);
  return c.json(task);
});

api.post("/tasks", async (c) => {
  const body = await c.req.json();
  const { project_id, title, description, assigned_to, status, tags } = body;
  if (!title) return c.json({ error: "title required" }, 400);
  const id = await createTask(
    project_id ?? null,
    title,
    description ?? null,
    assigned_to ?? null,
    status ?? "idea",
    tags ?? null
  );
  return c.json({ ok: true, id }, 201);
});

api.patch("/tasks/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json();
  const oldTask = await getTask(id);
  if (!oldTask) return c.json({ error: "not found" }, 404);

  const updated = await updateTask(id, body);
  if (!updated) return c.json({ error: "no changes" }, 400);

  // Auto-add status_change comment
  if (body.status && body.status !== (oldTask as any).status) {
    await addComment(id, body.changed_by ?? null, "status_change",
      `Status changed: ${(oldTask as any).status} → ${body.status}`);
  }

  return c.json({ ok: true });
});

api.delete("/tasks/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const deleted = await deleteTask(id);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

api.get("/tasks/:id/comments", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  return c.json(await getCommentsByTask(id));
});

api.post("/tasks/:id/comments", async (c) => {
  const taskId = parseInt(c.req.param("id"), 10);
  const body = await c.req.json();
  if (!body.content) return c.json({ error: "content required" }, 400);
  const id = await addComment(
    taskId,
    body.author ?? null,
    body.comment_type ?? "note",
    body.content
  );
  return c.json({ ok: true, id }, 201);
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
