import { getDb } from "../db.js";

export async function createTask(
  taskId: string,
  agentId: string,
  sessionId: string,
  description: string | null
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO tasks (task_id, agent_id, session_id, description)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (task_id) DO UPDATE SET description = excluded.description, updated_at = current_timestamp`,
    taskId, agentId, sessionId, description
  );
}

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE tasks SET status = ?, updated_at = current_timestamp WHERE task_id = ?`,
    status, taskId
  );
}

export async function getTasksBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at DESC`,
    sessionId
  );
}

export async function getTasksByAgent(agentId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC`,
    agentId
  );
}
