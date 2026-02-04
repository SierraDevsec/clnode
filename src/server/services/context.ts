import { getDb } from "../db.js";

export async function saveContext(
  sessionId: string,
  agentId: string | null,
  key: string,
  value: string
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO contexts (session_id, agent_id, key, value) VALUES (?, ?, ?, ?)`,
    sessionId, agentId, key, value
  );
}

export async function getContextsBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM contexts WHERE session_id = ? ORDER BY created_at DESC`,
    sessionId
  );
}

export async function getContextByKey(sessionId: string, key: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM contexts WHERE session_id = ? AND key = ? ORDER BY created_at DESC LIMIT 1`,
    sessionId, key
  );
}
