const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  return res.json() as Promise<T>;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
}

export interface Session {
  id: string;
  project_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
}

export interface Agent {
  id: string;
  session_id: string;
  agent_name: string;
  agent_type: string | null;
  parent_agent_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  context_summary: string | null;
}

export interface ContextEntry {
  id: number;
  session_id: string;
  agent_id: string | null;
  entry_type: string;
  content: string;
  tags: string[] | null;
  created_at: string;
}

export interface FileChange {
  id: number;
  session_id: string;
  agent_id: string | null;
  file_path: string;
  change_type: string;
  created_at: string;
}

export interface Task {
  id: number;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  author: string | null;
  comment_type: string;
  content: string;
  created_at: string;
}

export interface Stats {
  total_sessions: number;
  active_sessions: number;
  total_agents: number;
  active_agents: number;
  total_context_entries: number;
  total_file_changes: number;
}

export interface Activity {
  id: number;
  session_id: string;
  agent_id: string | null;
  event_type: string;
  details: string;
  created_at: string;
}

/** DuckDB now() stores local time but JSON serializes with 'Z' suffix.
 *  Strip 'Z' so JS treats it as local time, not UTC. */
export function localDate(ts: string | null): Date | null {
  if (!ts) return null;
  return new Date(ts.replace(/Z$/, ""));
}

export function formatDateTime(ts: string | null): string {
  const d = localDate(ts);
  if (!d) return "—";
  return d.toLocaleString();
}

export function formatTime(ts: string | null): string {
  const d = localDate(ts);
  if (!d) return "—";
  return d.toLocaleTimeString();
}

export const api = {
  health: () => get<{ status: string; uptime: number }>("/health"),
  projects: () => get<Project[]>("/projects"),
  sessions: (active?: boolean) => get<Session[]>(`/sessions${active ? "?active=true" : ""}`),
  session: (id: string) => get<Session>(`/sessions/${id}`),
  sessionAgents: (id: string) => get<Agent[]>(`/sessions/${id}/agents`),
  sessionContext: (id: string) => get<ContextEntry[]>(`/sessions/${id}/context`),
  sessionFiles: (id: string) => get<FileChange[]>(`/sessions/${id}/files`),
  sessionActivities: (id: string) => get<Activity[]>(`/sessions/${id}/activities`),
  agents: (active?: boolean) => get<Agent[]>(`/agents${active ? "?active=true" : ""}`),
  agentContext: (id: string) => get<ContextEntry[]>(`/agents/${id}/context`),
  agentFiles: (id: string) => get<FileChange[]>(`/agents/${id}/files`),
  agent: (id: string) => get<Agent>(`/agents/${id}`),
  tasks: (projectId?: string) => get<Task[]>(`/tasks${projectId ? `?project_id=${projectId}` : ""}`),
  task: (id: number) => get<Task>(`/tasks/${id}`),
  createTask: (data: { project_id?: string; title: string; description?: string; assigned_to?: string; status?: string; tags?: string[] }) =>
    post<{ ok: boolean; id: number }>("/tasks", data),
  updateTask: (id: number, data: Partial<Pick<Task, "title" | "description" | "status" | "assigned_to" | "tags">>) =>
    patch<{ ok: boolean }>(`/tasks/${id}`, data),
  deleteTask: (id: number) => del<{ ok: boolean }>(`/tasks/${id}`),
  taskComments: (taskId: number) => get<TaskComment[]>(`/tasks/${taskId}/comments`),
  addTaskComment: (taskId: number, data: { content: string; author?: string; comment_type?: string }) =>
    post<{ ok: boolean; id: number }>(`/tasks/${taskId}/comments`, data),
  activities: (limit?: number) => get<Activity[]>(`/activities${limit ? `?limit=${limit}` : ""}`),
  stats: () => get<Stats>("/stats"),
};
