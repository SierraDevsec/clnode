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

export async function updateTask(
  id: number,
  fields: {
    status?: string;
    title?: string;
    description?: string | null;
    assigned_to?: string | null;
  }
): Promise<boolean> {
  const db = await getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (fields.status !== undefined) {
    updates.push("status = ?");
    values.push(fields.status);
  }
  if (fields.title !== undefined) {
    updates.push("title = ?");
    values.push(fields.title);
  }
  if (fields.description !== undefined) {
    updates.push("description = ?");
    values.push(fields.description);
  }
  if (fields.assigned_to !== undefined) {
    updates.push("assigned_to = ?");
    values.push(fields.assigned_to);
  }

  if (updates.length === 0) return false;

  updates.push("updated_at = now()");
  values.push(id);

  const result = await db.run(
    `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`,
    ...values
  );

  return (result.changes ?? 0) > 0;
}

export async function deleteTask(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.run(`DELETE FROM tasks WHERE id = ?`, id);
  return (result.changes ?? 0) > 0;
}
