import { getDb } from "../db.js";

export async function saveEvent(
  sessionId: string | null,
  eventType: string,
  payload: unknown
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO events (session_id, event_type, payload) VALUES (?, ?, ?)`,
    sessionId, eventType, typeof payload === "string" ? payload : JSON.stringify(payload)
  );
}

export async function getEventsBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM events WHERE session_id = ? ORDER BY received_at DESC`,
    sessionId
  );
}

export async function getRecentEvents(limit: number = 100) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM events ORDER BY received_at DESC LIMIT ?`,
    limit
  );
}
