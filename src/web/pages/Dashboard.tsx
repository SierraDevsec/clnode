import { useEffect, useState } from "react";
import { api, type Session, type Agent, type Activity, type Task, type Stats, formatTime } from "../lib/api";
import { useWebSocket } from "../lib/useWebSocket";
import { Card } from "../components/Card";
import { Badge, type Variant } from "../components/Badge";
import { BarChart } from "../components/Chart";
import { RiTerminalBoxLine, RiRobot2Line, RiDatabase2Line, RiFileEditLine, RiPulseLine, RiTaskLine } from "react-icons/ri";

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { connected, events, reconnectCount } = useWebSocket();

  const loadData = () => {
    Promise.all([
      api.sessions(true),
      api.agents(true),
      api.agents(),
      api.activities(50),
      api.stats(),
      api.tasks(),
    ]).then(([s, a, allA, act, st, t]) => {
      setSessions(s);
      setAgents(a);
      setAllAgents(allA);
      setActivities(act);
      setStats(st);
      setTasks(t);
    });
  };

  useEffect(() => { loadData(); }, [reconnectCount]);
  useEffect(() => { if (events.length > 0) loadData(); }, [events.length]);

  const agentTypeCounts = allAgents.reduce<Record<string, number>>((acc, a) => {
    const type = a.agent_type || a.agent_name || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const agentTypeData = Object.entries(agentTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value, color: "bg-emerald-500" }));

  const activityTypeCounts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.event_type] = (acc[a.event_type] || 0) + 1;
    return acc;
  }, {});

  const EVENT_COLORS: Record<string, string> = {
    SessionStart: "bg-green-500",
    SessionEnd: "bg-red-500",
    SubagentStart: "bg-blue-500",
    SubagentStop: "bg-purple-500",
    PostToolUse: "bg-amber-500",
    UserPromptSubmit: "bg-cyan-500",
    Stop: "bg-orange-500",
  };

  const activityTypeData = Object.entries(activityTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: EVENT_COLORS[label] || "bg-zinc-500" }));

  const statCards = [
    { label: "Active Sessions", value: sessions.length, sub: stats ? `/ ${stats.total_sessions} total` : undefined, icon: RiTerminalBoxLine },
    { label: "Active Agents", value: agents.length, sub: stats ? `/ ${stats.total_agents} total` : undefined, icon: RiRobot2Line },
    { label: "Context Entries", value: stats?.total_context_entries ?? 0, icon: RiDatabase2Line },
    { label: "File Changes", value: stats?.total_file_changes ?? 0, icon: RiFileEditLine },
    { label: "Live Events", value: events.length, icon: RiPulseLine },
    { label: "Tasks", value: tasks.length, icon: RiTaskLine, sub: "all projects" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-zinc-50">Dashboard</h2>
        <Badge variant={connected ? "success" : "danger"} dot>{connected ? "LIVE" : "DISCONNECTED"}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-zinc-50">{s.value}</span>
                  {s.sub && <span className="text-xs text-zinc-600">{s.sub}</span>}
                </div>
                <div className="text-sm text-zinc-400 mt-1">{s.label}</div>
              </div>
              <s.icon className="w-5 h-5 text-zinc-600" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <BarChart data={agentTypeData} title="Agent Types" />
        </Card>
        <Card>
          <BarChart data={activityTypeData} title="Recent Activity Breakdown" />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Active Sessions</h3>
          <div className="space-y-2">
            {sessions.length === 0 && <p className="text-zinc-600 text-sm">No active sessions</p>}
            {sessions.map((s) => (
              <Card key={s.id} hover>
                <div className="text-sm font-mono text-zinc-200">{s.id}</div>
                <div className="text-xs text-zinc-500 mt-1">project: {s.project_id ?? "—"}</div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Recent Activity</h3>
          <div className="space-y-1">
            {activities.length === 0 && <p className="text-zinc-600 text-sm">No activity yet</p>}
            {activities.slice(0, 15).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs py-1">
                <EventBadge type={a.event_type} />
                <span className="text-zinc-400 font-mono">{a.agent_id?.slice(0, 8) ?? "system"}</span>
                <span className="text-zinc-600">{formatTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const variants: Record<string, Variant> = {
    SessionStart: "success",
    SessionEnd: "danger",
    SubagentStart: "info",
    SubagentStop: "purple",
    PostToolUse: "warning",
    UserPromptSubmit: "cyan",
    Stop: "orange",
  };
  return <Badge variant={variants[type] ?? "neutral"}>{type}</Badge>;
}
