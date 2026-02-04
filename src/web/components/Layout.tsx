import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/agents", label: "Agents" },
  { to: "/context", label: "Context" },
  { to: "/tasks", label: "Tasks" },
  { to: "/activity", label: "Activity" },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      <nav className="w-52 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-white mb-4 tracking-tight flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="w-6 h-6" />
          CLNODE
        </h1>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
