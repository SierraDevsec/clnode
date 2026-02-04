import { useEffect, useState } from "react";
import { api, type Session, type Agent, type Activity, type Stats, formatTime } from "../lib/api";
import { useWebSocket } from "../lib/useWebSocket";

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [subagentOnly, setSubagentOnly] = useState(false);
  const { connected, events, reconnectCount } = useWebSocket();

  const loadData = () => {
    Promise.all([
      api.sessions(true),
      api.agents(true),
      api.activities(20),
      api.stats(),
    ]).then(([s, a, act, st]) => {
      setSessions(s);
      setAgents(a);
      setActivities(act);
      setStats(st);
    });
  };

  useEffect(() => { loadData(); }, [reconnectCount]);
  useEffect(() => { if (events.length > 0) loadData(); }, [events.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <span className={`text-xs px-2 py-0.5 rounded ${connected ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
          {connected ? "LIVE" : "DISCONNECTED"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Sessions" value={sessions.length} sub={stats ? `/ ${stats.total_sessions} total` : undefined} />
        <StatCard label="Active Agents" value={agents.length} sub={stats ? `/ ${stats.total_agents} total` : undefined} />
        <StatCard label="Context Entries" value={stats?.total_context_entries ?? 0} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="File Changes" value={stats?.total_file_changes ?? 0} />
        <StatCard label="Live Events" value={events.length} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">Active Sessions</h3>
          <div className="space-y-2">
            {sessions.length === 0 && <p className="text-gray-600 text-sm">No active sessions</p>}
            {sessions.map((s) => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded p-3">
                <div className="text-sm font-mono text-white">{s.id}</div>
                <div className="text-xs text-gray-500 mt-1">project: {s.project_id ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recent Activity</h3>
            <button
              onClick={() => setSubagentOnly(!subagentOnly)}
              className={`px-2 py-0.5 rounded text-[10px] ${subagentOnly ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"}`}
            >
              Subagent Only
            </button>
          </div>
          <div className="space-y-1">
            {activities.length === 0 && <p className="text-gray-600 text-sm">No activity yet</p>}
            {activities.filter((a) => !subagentOnly || a.agent_id != null).slice(0, 15).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs py-1">
                <EventBadge type={a.event_type} />
                <span className="text-gray-400 font-mono">{a.agent_id?.slice(0, 8) ?? "system"}</span>
                <span className="text-gray-600">{formatTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-white">{value}</div>
        {sub && <div className="text-xs text-gray-600">{sub}</div>}
      </div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    SessionStart: "bg-green-900 text-green-300",
    SessionEnd: "bg-red-900 text-red-300",
    SubagentStart: "bg-blue-900 text-blue-300",
    SubagentStop: "bg-purple-900 text-purple-300",
    PostToolUse: "bg-yellow-900 text-yellow-300",
    UserPromptSubmit: "bg-cyan-900 text-cyan-300",
    Stop: "bg-orange-900 text-orange-300",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[type] ?? "bg-gray-800 text-gray-400"}`}>
      {type}
    </span>
  );
}
