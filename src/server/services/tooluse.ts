import { getDb } from "../db.js";

export async function recordToolUse(
  sessionId: string,
  agentId: string | null,
  toolName: string,
  toolInput: string | null,
  toolOutput: string | null
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO tool_uses (session_id, agent_id, tool_name, tool_input, tool_output) VALUES (?, ?, ?, ?, ?)`,
    sessionId, agentId, toolName, toolInput, toolOutput
  );
}

export async function getToolUsesBySession(sessionId: string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM tool_uses WHERE session_id = ? ORDER BY used_at DESC`,
    sessionId
  );
}

export async function getRecentToolUses(limit: number = 50) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM tool_uses ORDER BY used_at DESC LIMIT ?`,
    limit
  );
}
