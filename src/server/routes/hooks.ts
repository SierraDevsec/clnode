import { Hono } from "hono";
import { startSession, endSession } from "../services/session.js";
import { startAgent, stopAgent, getAgent } from "../services/agent.js";
import { addContextEntry } from "../services/context.js";
import { recordFileChange } from "../services/filechange.js";
import { logActivity } from "../services/activity.js";
import { findProjectByPath, registerProject } from "../services/project.js";
import { buildSmartContext, checkIncompleteTasks, buildPromptContext } from "../services/intelligence.js";
import { broadcast } from "./ws.js";

const hooks = new Hono();

hooks.post("/:event", async (c) => {
  const event = c.req.param("event");
  const body = await c.req.json().catch(() => ({}));
  const sessionId = body.session_id ?? "unknown";

  try {
    switch (event) {
      case "SessionStart": {
        const cwd = body.cwd ?? body.project_path ?? null;
        let projectId: string | null = null;
        if (cwd) {
          const project = await findProjectByPath(cwd);
          if (project) projectId = (project as { id: string }).id;
        }
        await startSession(sessionId, projectId);
        await logActivity(sessionId, null, "SessionStart", { cwd, project_id: projectId });
        broadcast("SessionStart", { session_id: sessionId, project_id: projectId });
        return c.json({});
      }

      case "SessionEnd": {
        await endSession(sessionId);
        await logActivity(sessionId, null, "SessionEnd", {});
        broadcast("SessionEnd", { session_id: sessionId });
        return c.json({});
      }

      case "SubagentStart": {
        const agentId = body.agent_id ?? crypto.randomUUID();
        const toolInput = body.tool_input ?? {};
        const agentName = toolInput.subagent_type ?? toolInput.name ?? "unknown";
        const agentType = toolInput.subagent_type ?? null;
        const parentAgentId = body.parent_agent_id ?? null;

        await startAgent(agentId, sessionId, agentName, agentType, parentAgentId);
        await logActivity(sessionId, agentId, "SubagentStart", { agent_name: agentName, agent_type: agentType });
        broadcast("SubagentStart", { session_id: sessionId, agent_id: agentId, agent_name: agentName });

        // Phase 3: Smart context injection
        const additionalContext = await buildSmartContext(sessionId, agentName, agentType, parentAgentId);

        return c.json({
          hookSpecificOutput: {
            hookEventName: "SubagentStart",
            ...(additionalContext ? { additionalContext } : {}),
          },
        });
      }

      case "SubagentStop": {
        const agentId = body.agent_id ?? null;
        const contextSummary = body.context_summary ?? body.result ?? null;
        if (agentId) {
          const agent = await getAgent(agentId);
          const agentName = agent?.agent_name ?? "unknown";

          await stopAgent(agentId, contextSummary);
          if (contextSummary) {
            await addContextEntry(sessionId, agentId, "agent_summary", contextSummary, ["auto", agentName]);
          }

          // Phase 3: Todo Enforcer — check incomplete tasks
          const warning = await checkIncompleteTasks(sessionId, agentId, agentName);
          if (warning) {
            await addContextEntry(sessionId, agentId, "todo_warning", warning, ["enforcer", agentName]);
          }

          await logActivity(sessionId, agentId, "SubagentStop", {
            context_summary: contextSummary,
            incomplete_tasks: warning ? true : false,
          });
          broadcast("SubagentStop", { session_id: sessionId, agent_id: agentId, incomplete_tasks: !!warning });
        }
        return c.json({});
      }

      case "PostToolUse": {
        const agentId = body.agent_id ?? null;
        const toolName = body.tool_name ?? body.tool ?? "";
        const toolInput = body.tool_input ?? {};

        if (toolName === "Edit" || toolName === "Write") {
          const filePath = toolInput.file_path ?? toolInput.path ?? "unknown";
          const changeType = toolName === "Write" ? "create" : "edit";
          await recordFileChange(sessionId, agentId, filePath, changeType);
        }

        await logActivity(sessionId, agentId, "PostToolUse", { tool_name: toolName });
        broadcast("PostToolUse", { session_id: sessionId, tool_name: toolName });
        return c.json({});
      }

      case "Stop": {
        await logActivity(sessionId, null, "Stop", { reason: body.reason });
        broadcast("Stop", { session_id: sessionId });
        return c.json({});
      }

      case "UserPromptSubmit": {
        const prompt = body.prompt ?? body.message ?? "";
        await logActivity(sessionId, null, "UserPromptSubmit", { prompt: prompt.slice(0, 500) });
        broadcast("UserPromptSubmit", { session_id: sessionId });

        // Phase 3: Auto-attach project context to user prompts
        const promptContext = await buildPromptContext(sessionId);

        return c.json({
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            ...(promptContext ? { additionalContext: promptContext } : {}),
          },
        });
      }

      case "RegisterProject": {
        const pid = body.project_id ?? crypto.randomUUID();
        const pname = body.project_name ?? "unknown";
        const ppath = body.project_path ?? "";
        await registerProject(pid, pname, ppath);
        return c.json({ ok: true, project_id: pid });
      }

      default: {
        await logActivity(sessionId, null, event, body);
        broadcast(event, body);
        return c.json({});
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[hooks/${event}] Error:`, msg);
    // SubagentStart must always return hookSpecificOutput structure
    if (event === "SubagentStart") {
      return c.json({ hookSpecificOutput: { hookEventName: "SubagentStart" } });
    }
    if (event === "UserPromptSubmit") {
      return c.json({ hookSpecificOutput: { hookEventName: "UserPromptSubmit" } });
    }
    return c.json({});
  }
});

export default hooks;
