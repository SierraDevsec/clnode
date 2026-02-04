import { getDb } from "../db.js";

export async function startAgent(
  id: string,
  sessionId: string,
  agentName: string,
  agentType: string | null,
  parentAgentId: string | null
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO agents (id, session_id, agent_name, agent_type, parent_agent_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET status = 'active', started_at = now()`,
    id, sessionId, agentName, agentType, parentAgentId
  );
}

export async function stopAgent(id: string, contextSummary: string | null): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE agents SET status = 'completed', completed_at = now(), context_summary = ?
     WHERE id = ?`,
    contextSummary, id
  );
}

export async function getAgent(id: string) {
  const db = await getDb();
  const rows = await db.all(`SELECT * FROM agents WHERE id = ?`, id);
  return rows[0] ?? null;
}

export async function getAgentsBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM agents WHERE session_id = ? ORDER BY started_at DESC`, sessionId
  );
}

export async function getActiveAgents() {
  const db = await getDb();
  return db.all(`SELECT * FROM agents WHERE status = 'active' ORDER BY started_at DESC`);
}

export async function getAllAgents() {
  const db = await getDb();
  return db.all(`SELECT * FROM agents ORDER BY started_at DESC`);
}

export async function getTotalAgentsCount() {
  const db = await getDb();
  const result = await db.all(`SELECT COUNT(*) as count FROM agents`);
  return result[0]?.count || 0;
}

export async function getActiveAgentsCount() {
  const db = await getDb();
  const result = await db.all(`SELECT COUNT(*) as count FROM agents WHERE status = 'active'`);
  return result[0]?.count || 0;
}
