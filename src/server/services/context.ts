import { getDb } from "../db.js";

export async function addContextEntry(
  sessionId: string,
  agentId: string | null,
  entryType: string,
  content: string,
  tags: string[] | null
): Promise<void> {
  const db = await getDb();
  const tagsLiteral = tags && tags.length > 0
    ? `[${tags.map(t => `'${t.replace(/'/g, "''")}'`).join(",")}]`
    : null;
  await db.run(
    `INSERT INTO context_entries (session_id, agent_id, entry_type, content, tags)
     VALUES (?, ?, ?, ?, ${tagsLiteral ? `${tagsLiteral}::VARCHAR[]` : "NULL"})`,
    sessionId, agentId, entryType, content
  );
}

export async function getContextBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM context_entries WHERE session_id = ? ORDER BY created_at DESC`,
    sessionId
  );
}

export async function getContextByAgent(agentId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM context_entries WHERE agent_id = ? ORDER BY created_at DESC`,
    agentId
  );
}

export async function getContextByType(sessionId: string, entryType: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM context_entries WHERE session_id = ? AND entry_type = ? ORDER BY created_at DESC`,
    sessionId, entryType
  );
}

export async function getRecentContext(sessionId: string, limit: number = 20) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM context_entries WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
    sessionId, limit
  );
}
