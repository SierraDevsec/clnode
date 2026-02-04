import { useEffect, useState } from "react";
import { api, type Agent, type Session, formatDateTime, formatTime } from "../lib/api";
import { useWebSocket } from "../lib/useWebSocket";
import { Card } from "../components/Card";
import { Badge, statusVariant } from "../components/Badge";
import { AgentDetail } from "../components/AgentDetail";

type Filter = "all" | "active" | "completed";

export default function Agents() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agentsBySession, setAgentsBySession] = useState<Record<string, Agent[]>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const { events, reconnectCount } = useWebSocket();

  const loadData = async () => {
    const allSessions = await api.sessions();
    setSessions(allSessions);
    const map: Record<string, Agent[]> = {};
    await Promise.all(
      allSessions.map(async (s) => {
        map[s.id] = await api.sessionAgents(s.id);
      })
    );
    setAgentsBySession(map);
  };

  useEffect(() => { loadData(); }, [reconnectCount]);
  useEffect(() => { if (events.length > 0) loadData(); }, [events.length]);

  const allAgents = Object.values(agentsBySession).flat();
  const totalCount = allAgents.length;

  const filterAgents = (agents: Agent[]) =>
    filter === "all" ? agents : agents.filter((a) => a.status === filter);

  const visibleSessions = sessions.filter((s) => filterAgents(agentsBySession[s.id] ?? []).length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-50">Agents</h2>
        <div className="flex gap-1">
          {(["all", "active", "completed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${filter === f ? "bg-emerald-900/60 text-emerald-300" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">{totalCount} agents</span>
      </div>

      <div className="space-y-4">
        {visibleSessions.length === 0 && <p className="text-zinc-600 text-sm">No agents found</p>}
        {visibleSessions.map((session) => {
          const agents = filterAgents(agentsBySession[session.id] ?? []);
          return (
            <div key={session.id} className="space-y-1">
              <div className="flex items-center gap-2 px-1">
                <Badge variant={statusVariant(session.status)} dot>{session.status}</Badge>
                <span className="text-xs font-mono text-zinc-400">{session.id.slice(0, 12)}</span>
                {session.project_id && <span className="text-xs text-zinc-500">{session.project_id}</span>}
                <span className="text-xs text-zinc-600">{formatDateTime(session.started_at)}</span>
              </div>
              {agents.map((agent, i) => {
                const isExpanded = expandedAgent === agent.id;
                return (
                  <div key={agent.id} className="flex items-start gap-2 ml-3">
                    <span className="text-zinc-600 text-sm mt-3 shrink-0">{i === agents.length - 1 ? "└─" : "├─"}</span>
                    <Card className="flex-1 cursor-pointer" hover>
                      <div onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-zinc-200">{agent.agent_name}</span>
                          <Badge variant={statusVariant(agent.status)} dot>{agent.status}</Badge>
                          {agent.agent_type && agent.agent_type !== agent.agent_name && (
                            <span className="text-xs text-zinc-500">[{agent.agent_type}]</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 flex gap-3">
                          <span>id: {agent.id.slice(0, 12)}</span>
                          {agent.completed_at && <span>completed: {formatTime(agent.completed_at)}</span>}
                        </div>
                        {!isExpanded && agent.context_summary && (
                          <div className="mt-2 text-xs text-zinc-400 bg-zinc-800/50 rounded-lg p-2 line-clamp-2">
                            {agent.context_summary}
                          </div>
                        )}
                      </div>
                      {isExpanded && <AgentDetail agent={agent} />}
                    </Card>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
