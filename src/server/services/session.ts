import { getDb } from "../db.js";

export async function startSession(sessionId: string, projectPath: string | null): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO sessions (session_id, project_path)
     VALUES (?, ?)
     ON CONFLICT (session_id) DO UPDATE SET status = 'active', started_at = current_timestamp`,
    sessionId, projectPath
  );
}

export async function endSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE sessions SET status = 'ended', ended_at = current_timestamp WHERE session_id = ?`,
    sessionId
  );
  // 세션 종료 시 관련 에이전트도 모두 종료
  await db.run(
    `UPDATE agents SET status = 'stopped', ended_at = current_timestamp
     WHERE session_id = ? AND status = 'active'`,
    sessionId
  );
}

export async function getActiveSessions() {
  const db = await getDb();
  return db.all(`SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC`);
}

export async function getAllSessions() {
  const db = await getDb();
  return db.all(`SELECT * FROM sessions ORDER BY started_at DESC`);
}

export async function getSession(sessionId: string) {
  const db = await getDb();
  const rows = await db.all(`SELECT * FROM sessions WHERE session_id = ?`, sessionId);
  return rows[0] ?? null;
}
