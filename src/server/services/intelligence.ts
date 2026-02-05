import {
  getSiblingAgents,
  getSameTypeAgents,
  getCrossSessionContext,
  getTaggedContext,
  getRecentContext,
  getAssignedTasks,
  getActiveAgents,
  getOpenTasks,
  getDecisions,
  getCompletedAgents,
  getIncompleteTasks,
} from "./queries/index.js";

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
  const sections: string[] = [];

  // 1. Sibling agent summaries (same parent, same session — most relevant)
  if (parentAgentId) {
    const siblings = await getSiblingAgents(sessionId, parentAgentId);

    if (siblings.length > 0) {
      const lines = siblings.map(
        (s) => `- [${s.agent_name}] ${s.context_summary}`
      );
      sections.push(`## Sibling Agent Results\n${lines.join("\n")}`);
    }
  }

  // 2. Same-type agent history (agents with same name/type — learn from predecessors)
  if (agentType) {
    const sameType = await getSameTypeAgents(agentType, sessionId, parentAgentId);

    if (sameType.length > 0) {
      const lines = sameType.map(
        (s) => `- [${s.agent_name}] ${s.context_summary}`
      );
      sections.push(`## Previous ${agentType} Agent Results\n${lines.join("\n")}`);
    }
  }

  // 3. Cross-session context (same project, previous sessions)
  const crossSession = await getCrossSessionContext(sessionId);

  if (crossSession.length > 0) {
    const lines = crossSession.map(
      (e) => `- [${e.entry_type}${e.agent_name ? ` by ${e.agent_name}` : ""}] ${e.content}`
    );
    sections.push(`## Cross-Session Context\n${lines.join("\n")}`);
  }

  // 4. Current session context (tagged entries relevant to this agent)
  const taggedContext = await getTaggedContext(sessionId, agentName, agentType);

  if (taggedContext.length > 0) {
    const lines = taggedContext.map(
      (e) => `- [${e.entry_type}] ${e.content}`
    );
    sections.push(`## Relevant Context\n${lines.join("\n")}`);
  }

  // 5. Fallback: if nothing found, use recent session context
  if (sections.length === 0) {
    const recent = await getRecentContext(sessionId);

    if (recent.length > 0) {
      const lines = recent.map(
        (e) => `- [${e.entry_type}] ${e.content}`
      );
      sections.push(`## Recent Context\n${lines.join("\n")}`);
    }
  }

  // 6. Active tasks assigned to this agent (with plan comments and tags)
  const tasks = await getAssignedTasks(sessionId, agentName);

  if (tasks.length > 0) {
    const taskLines: string[] = [];
    for (const t of tasks) {
      const tagsStr = t.tags && t.tags.length > 0 ? ` [${t.tags.join(", ")}]` : "";
      let line = `- [${t.status}] ${t.title}${tagsStr}${t.description ? ": " + t.description.slice(0, 100) : ""}`;
      // Include plan comment if available
      if (t.planComment) {
        line += `\n  Plan: ${t.planComment.slice(0, 200)}`;
      }
      taskLines.push(line);
    }
    sections.push(`## Your Assigned Tasks\n${taskLines.join("\n")}`);
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
  const incomplete = await getIncompleteTasks(sessionId, agentName);

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
  const sections: string[] = [];

  // Active agents
  const activeAgents = await getActiveAgents(sessionId);

  if (activeAgents.length > 0) {
    const lines = activeAgents.map(
      (a) => `- ${a.agent_name}${a.agent_type ? ` (${a.agent_type})` : ""}`
    );
    sections.push(`## Active Agents\n${lines.join("\n")}`);
  }

  // Open tasks for this project (5-stage priority order, excluding completed)
  const { tasks, backlogCount } = await getOpenTasks(sessionId);

  if (tasks.length > 0 || backlogCount > 0) {
    const lines = tasks.map(
      (t) => {
        const tagsStr = t.tags && t.tags.length > 0 ? ` [${t.tags.join(", ")}]` : "";
        return `- [${t.status}] ${t.title}${tagsStr}${t.assigned_to ? ` → ${t.assigned_to}` : ""}`;
      }
    );
    if (backlogCount > 0) {
      lines.push(`\n(+${backlogCount} in backlog)`);
    }
    sections.push(`## Open Tasks\n${lines.join("\n")}`);
  }

  // Recent decisions/blockers
  const decisions = await getDecisions(sessionId);

  if (decisions.length > 0) {
    const lines = decisions.map(
      (d) => `- [${d.entry_type}] ${d.content}`
    );
    sections.push(`## Recent Decisions & Blockers\n${lines.join("\n")}`);
  }

  // Completed agent summaries (this session)
  const completedAgents = await getCompletedAgents(sessionId);

  if (completedAgents.length > 0) {
    const lines = completedAgents.map(
      (a) => `- [${a.agent_name}] ${a.context_summary}`
    );
    sections.push(`## Completed Agent Summaries\n${lines.join("\n")}`);
  }

  if (sections.length === 0) {
    return "[clnode project context]\n\n(No active tasks or agents)";
  }

  return `[clnode project context]\n\n${sections.join("\n\n")}`;
}
