import { Hono } from "hono";
import { startSession, endSession } from "../services/session.js";
import { startAgent, stopAgent } from "../services/agent.js";
import { recordToolUse } from "../services/tooluse.js";
import { logActivity } from "../services/activity.js";
import { saveEvent } from "../services/event.js";
import { broadcast } from "./ws.js";

const hooks = new Hono();

hooks.post("/:event", async (c) => {
  const event = c.req.param("event");
  const body = await c.req.json().catch(() => ({}));

  // 원시 이벤트 항상 저장
  const sessionId = body.session_id ?? body.sessionId ?? null;
  await saveEvent(sessionId, event, body);

  try {
    switch (event) {
      case "SessionStart": {
        const sid = body.session_id ?? body.sessionId ?? crypto.randomUUID();
        const projectPath = body.project_path ?? body.cwd ?? null;
        await startSession(sid, projectPath);
        await logActivity(sid, null, "SessionStart", `Session started: ${sid}`);
        broadcast("SessionStart", { session_id: sid, project_path: projectPath });
        return c.json({ ok: true, session_id: sid });
      }

      case "SessionEnd": {
        const sid = body.session_id ?? body.sessionId;
        if (sid) {
          await endSession(sid);
          await logActivity(sid, null, "SessionEnd", `Session ended: ${sid}`);
          broadcast("SessionEnd", { session_id: sid });
        }
        return c.json({ ok: true });
      }

      case "SubagentStart": {
        const sid = body.session_id ?? body.sessionId ?? "unknown";
        const agentId = body.agent_id ?? body.agentId ?? crypto.randomUUID();
        const parentId = body.parent_agent_id ?? body.parentAgentId ?? null;
        const agentType = body.agent_type ?? body.type ?? null;
        const model = body.model ?? null;
        await startAgent(agentId, sid, parentId, agentType, model);
        await logActivity(sid, agentId, "SubagentStart", `Agent started: ${agentType ?? agentId}`);
        broadcast("SubagentStart", { session_id: sid, agent_id: agentId, agent_type: agentType });
        return c.json({ ok: true, agent_id: agentId });
      }

      case "SubagentStop": {
        const sid = body.session_id ?? body.sessionId ?? "unknown";
        const agentId = body.agent_id ?? body.agentId;
        if (agentId) {
          await stopAgent(agentId);
          await logActivity(sid, agentId, "SubagentStop", `Agent stopped: ${agentId}`);
          broadcast("SubagentStop", { session_id: sid, agent_id: agentId });
        }
        return c.json({ ok: true });
      }

      case "PostToolUse": {
        const sid = body.session_id ?? body.sessionId ?? "unknown";
        const agentId = body.agent_id ?? body.agentId ?? null;
        const toolName = body.tool_name ?? body.tool ?? "unknown";
        const toolInput = body.tool_input ? JSON.stringify(body.tool_input) : null;
        const toolOutput = body.tool_output ? JSON.stringify(body.tool_output) : null;
        await recordToolUse(sid, agentId, toolName, toolInput, toolOutput);
        await logActivity(sid, agentId, "PostToolUse", `Tool used: ${toolName}`);
        broadcast("PostToolUse", { session_id: sid, tool_name: toolName });
        return c.json({ ok: true });
      }

      case "Stop": {
        const sid = body.session_id ?? body.sessionId ?? "unknown";
        await logActivity(sid, null, "Stop", body.reason ?? "Stop signal received");
        broadcast("Stop", { session_id: sid, reason: body.reason });
        return c.json({ ok: true });
      }

      case "UserPromptSubmit": {
        const sid = body.session_id ?? body.sessionId ?? "unknown";
        const prompt = body.prompt ?? body.message ?? "";
        await logActivity(sid, null, "UserPromptSubmit", `User prompt: ${prompt.slice(0, 200)}`);
        broadcast("UserPromptSubmit", { session_id: sid, prompt });
        return c.json({ ok: true });
      }

      default: {
        await logActivity(sessionId ?? "unknown", null, event, `Unknown event: ${event}`);
        broadcast(event, body);
        return c.json({ ok: true, event, message: "unhandled event type, stored as raw" });
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[hooks/${event}] Error:`, msg);
    return c.json({ ok: false, error: msg }, 500);
  }
});

export default hooks;
