import { getDb } from "../db.js";

export async function createTask(
  projectId: string | null,
  title: string,
  description: string | null,
  assignedTo: string | null
): Promise<number> {
  const db = await getDb();
  await db.run(
    `INSERT INTO tasks (project_id, title, description, assigned_to) VALUES (?, ?, ?, ?)`,
    projectId, title, description, assignedTo
  );
  const rows = await db.all(`SELECT lastval() as id`);
  return (rows[0] as { id: number }).id;
}

export async function updateTaskStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE tasks SET status = ?, updated_at = now() WHERE id = ?`, status, id
  );
}

export async function getTasksByProject(projectId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC`, projectId
  );
}

export async function getAllTasks() {
  const db = await getDb();
  return db.all(`SELECT * FROM tasks ORDER BY created_at DESC`);
}
