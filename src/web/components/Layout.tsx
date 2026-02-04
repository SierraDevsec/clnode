import { NavLink, Outlet } from "react-router-dom";
import { RiDashboardLine, RiRobot2Line, RiDatabase2Line, RiTaskLine, RiPulseLine } from "react-icons/ri";
import { useProject } from "../lib/ProjectContext";

const links = [
  { to: "/", label: "Dashboard", icon: RiDashboardLine },
  { to: "/agents", label: "Agents", icon: RiRobot2Line },
  { to: "/context", label: "Context", icon: RiDatabase2Line },
  { to: "/tasks", label: "Tasks", icon: RiTaskLine },
  { to: "/activity", label: "Activity", icon: RiPulseLine },
];

export default function Layout() {
  const { projects, selected, setSelected } = useProject();

  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      <nav className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 pb-6">
          <h1 className="text-lg font-semibold tracking-wide flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="w-5 h-5" />
            <span className="text-emerald-400">clnode</span>
          </h1>
        </div>

        <div className="flex-1 px-3 space-y-0.5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-800/60 text-emerald-400"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-800">
          <select
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value || null)}
            className="cl-select w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </nav>

      <main className="flex-1 p-6 overflow-auto bg-[var(--bg-primary)]">
        <Outlet />
      </main>
    </div>
  );
}
