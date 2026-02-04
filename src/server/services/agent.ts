import { getDb } from "../db.js";

export async function startAgent(
  agentId: string,
  sessionId: string,
  parentAgentId: string | null,
  agentType: string | null,
  model: string | null
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO agents (agent_id, session_id, parent_agent_id, agent_type, model)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (agent_id) DO UPDATE SET status = 'active', started_at = now()`,
    agentId, sessionId, parentAgentId, agentType, model
  );
}

export async function stopAgent(agentId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE agents SET status = 'stopped', ended_at = now() WHERE agent_id = ?`,
    agentId
  );
}

export async function getAgentsBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM agents WHERE session_id = ? ORDER BY started_at DESC`,
    sessionId
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
