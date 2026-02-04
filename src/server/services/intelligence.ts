import { getDb } from "../db.js";

interface ContextRow {
  id: number;
  session_id: string;
  agent_id: string | null;
  entry_type: string;
  content: string;
  tags: string[] | null;
  created_at: string;
}

interface AgentRow {
  id: string;
  session_id: string;
  agent_name: string;
  agent_type: string | null;
  parent_agent_id: string | null;
  status: string;
  context_summary: string | null;
}

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
}

async function safeQuery<T>(label: string, fn: () => Promise<unknown[]>): Promise<T[]> {
  try {
    return await fn() as T[];
  } catch (err) {
    console.error(`[intelligence/${label}] query failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Smart context injection for SubagentStart.
 * Instead of blindly returning recent 10 entries, selects context
 * based on agent role relevance, sibling agents, and cross-session history.
 * Each query is independently protected — partial results are returned on failure.
 */
export async function buildSmartContext(
  sessionId: string,
  agentName: string,
  agentType: string | null,
  parentAgentId: string | null
): Promise<string> {
  const db = await getDb();
  const sections: string[] = [];

  // 1. Sibling agent summaries (same parent, same session — most relevant)
  if (parentAgentId) {
    const siblings = await safeQuery<AgentRow>("siblings", () => db.all(
      `SELECT agent_name, agent_type, context_summary
       FROM agents
       WHERE session_id = ? AND parent_agent_id = ? AND status = 'completed' AND context_summary IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 5`,
      sessionId, parentAgentId
    ));

    if (siblings.length > 0) {
      const lines = siblings.map(
        (s) => `- [${s.agent_name}] ${s.context_summary}`
      );
      sections.push(`## Sibling Agent Results\n${lines.join("\n")}`);
    }
  }

  // 2. Same-type agent history (agents with same name/type — learn from predecessors)
  if (agentType) {
    const sameType = await safeQuery<AgentRow>("same-type", () => db.all(
      `SELECT agent_name, context_summary, session_id
       FROM agents
       WHERE agent_type = ? AND status = 'completed' AND context_summary IS NOT NULL
         AND id NOT IN (
           SELECT id FROM agents WHERE session_id = ? AND parent_agent_id = ?
         )
       ORDER BY completed_at DESC
       LIMIT 3`,
      agentType, sessionId, parentAgentId ?? ""
    ));

    if (sameType.length > 0) {
      const lines = sameType.map(
        (s) => `- [${s.agent_name}] ${s.context_summary}`
      );
      sections.push(`## Previous ${agentType} Agent Results\n${lines.join("\n")}`);
    }
  }

  // 3. Cross-session context (same project, previous sessions)
  const crossSession = await safeQuery<ContextRow & { agent_name?: string }>("cross-session", () => db.all(
    `SELECT ce.entry_type, ce.content, ce.tags, a.agent_name
     FROM context_entries ce
     LEFT JOIN agents a ON ce.agent_id = a.id
     JOIN sessions s ON ce.session_id = s.id
     WHERE s.project_id IN (SELECT project_id FROM sessions WHERE id = ?)
       AND ce.session_id != ?
       AND ce.entry_type IN ('agent_summary', 'decision', 'blocker', 'handoff')
     ORDER BY ce.created_at DESC
     LIMIT 5`,
    sessionId, sessionId
  ));

  if (crossSession.length > 0) {
    const lines = crossSession.map(
      (e) => `- [${e.entry_type}${e.agent_name ? ` by ${e.agent_name}` : ""}] ${e.content}`
    );
    sections.push(`## Cross-Session Context\n${lines.join("\n")}`);
  }

  // 4. Current session context (tagged entries relevant to this agent)
  const tagParams = [sessionId, agentName, agentType ?? ""];
  const taggedContext = await safeQuery<ContextRow>("tagged", () => db.all(
    `SELECT entry_type, content, tags
     FROM context_entries
     WHERE session_id = ?
       AND (
         (tags IS NOT NULL AND (list_contains(tags, ?) OR list_contains(tags, ?) OR list_contains(tags, 'all')))
         OR entry_type IN ('decision', 'blocker', 'handoff')
       )
     ORDER BY created_at DESC
     LIMIT 5`,
    ...tagParams
  ));

  if (taggedContext.length > 0) {
    const lines = taggedContext.map(
      (e) => `- [${e.entry_type}] ${e.content}`
    );
    sections.push(`## Relevant Context\n${lines.join("\n")}`);
  }

  // 5. Fallback: if nothing found, use recent session context
  if (sections.length === 0) {
    const recent = await safeQuery<ContextRow>("recent-fallback", () => db.all(
      `SELECT entry_type, content
       FROM context_entries
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      sessionId
    ));

    if (recent.length > 0) {
      const lines = recent.map(
        (e) => `- [${e.entry_type}] ${e.content}`
      );
      sections.push(`## Recent Context\n${lines.join("\n")}`);
    }
  }

  // 6. Active tasks assigned to this agent
  const tasks = await safeQuery<TaskRow>("assigned-tasks", () => db.all(
    `SELECT t.title, t.description, t.status
     FROM tasks t
     JOIN sessions s ON t.project_id = s.project_id
     WHERE s.id = ? AND t.assigned_to = ? AND t.status != 'completed'
     ORDER BY t.created_at ASC`,
    sessionId, agentName
  ));

  if (tasks.length > 0) {
    const lines = tasks.map(
      (t) => `- [${t.status}] ${t.title}${t.description ? ": " + t.description.slice(0, 100) : ""}`
    );
    sections.push(`## Your Assigned Tasks\n${lines.join("\n")}`);
  }

  if (sections.length === 0) return "";

  return `[clnode smart context for ${agentName}]\n\n${sections.join("\n\n")}`;
}

/**
 * Todo Enforcer: check incomplete tasks on SubagentStop.
 * Returns a warning string if agent has unfinished tasks.
 */
export async function checkIncompleteTasks(
  sessionId: string,
  agentId: string,
  agentName: string
): Promise<string | null> {
  const incomplete = await safeQuery<TaskRow>("todo-enforcer", async () => {
    const db = await getDb();
    return db.all(
      `SELECT t.title, t.status
       FROM tasks t
       JOIN sessions s ON t.project_id = s.project_id
       WHERE s.id = ? AND t.assigned_to = ? AND t.status NOT IN ('completed', 'cancelled')
       ORDER BY t.created_at ASC`,
      sessionId, agentName
    );
  });

  if (incomplete.length === 0) return null;

  const lines = incomplete.map((t) => `- [${t.status}] ${t.title}`);
  return `[clnode warning] Agent ${agentName} stopping with ${incomplete.length} incomplete task(s):\n${lines.join("\n")}`;
}

/**
 * Build project context for UserPromptSubmit.
 * Attaches active tasks, recent decisions, and active agents summary.
 * Each query is independently protected for partial success.
 */
export async function buildPromptContext(
  sessionId: string
): Promise<string> {
  const db = await getDb();
  const sections: string[] = [];

  // Active agents
  const activeAgents = await safeQuery<AgentRow>("prompt-agents", () => db.all(
    `SELECT agent_name, agent_type, started_at
     FROM agents
     WHERE session_id = ? AND status = 'active'
     ORDER BY started_at DESC`,
    sessionId
  ));

  if (activeAgents.length > 0) {
    const lines = activeAgents.map(
      (a) => `- ${a.agent_name}${a.agent_type ? ` (${a.agent_type})` : ""}`
    );
    sections.push(`## Active Agents\n${lines.join("\n")}`);
  }

  // Pending/in-progress tasks for this project
  const tasks = await safeQuery<TaskRow>("prompt-tasks", () => db.all(
    `SELECT t.title, t.status, t.assigned_to
     FROM tasks t
     JOIN sessions s ON t.project_id = s.project_id
     WHERE s.id = ? AND t.status NOT IN ('completed', 'cancelled')
     ORDER BY t.created_at ASC
     LIMIT 10`,
    sessionId
  ));

  if (tasks.length > 0) {
    const lines = tasks.map(
      (t) => `- [${t.status}] ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ""}`
    );
    sections.push(`## Open Tasks\n${lines.join("\n")}`);
  }

  // Recent decisions/blockers
  const decisions = await safeQuery<ContextRow>("prompt-decisions", () => db.all(
    `SELECT entry_type, content
     FROM context_entries
     WHERE session_id = ?
       AND entry_type IN ('decision', 'blocker', 'handoff')
     ORDER BY created_at DESC
     LIMIT 5`,
    sessionId
  ));

  if (decisions.length > 0) {
    const lines = decisions.map(
      (d) => `- [${d.entry_type}] ${d.content}`
    );
    sections.push(`## Recent Decisions & Blockers\n${lines.join("\n")}`);
  }

  // Completed agent summaries (this session)
  const completedAgents = await safeQuery<AgentRow>("prompt-completed", () => db.all(
    `SELECT agent_name, context_summary
     FROM agents
     WHERE session_id = ? AND status = 'completed' AND context_summary IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 5`,
    sessionId
  ));

  if (completedAgents.length > 0) {
    const lines = completedAgents.map(
      (a) => `- [${a.agent_name}] ${a.context_summary}`
    );
    sections.push(`## Completed Agent Summaries\n${lines.join("\n")}`);
  }

  if (sections.length === 0) return "";

  return `[clnode project context]\n\n${sections.join("\n\n")}`;
}
