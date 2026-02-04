import { getDb } from "../db.js";

export async function logActivity(
  sessionId: string,
  agentId: string | null,
  eventType: string,
  summary: string | null
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO activities (session_id, agent_id, event_type, summary) VALUES (?, ?, ?, ?)`,
    sessionId, agentId, eventType, summary
  );
}

export async function getActivitiesBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM activities WHERE session_id = ? ORDER BY created_at DESC`,
    sessionId
  );
}

export async function getRecentActivities(limit: number = 50) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM activities ORDER BY created_at DESC LIMIT ?`,
    limit
  );
}
