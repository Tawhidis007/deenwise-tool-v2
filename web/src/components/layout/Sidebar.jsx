import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { routes } from "../../routes/routes";

const Sidebar = ({ onCollapse }) => {
  const navigate = useNavigate();
  const handleLogout = () => {
    sessionStorage.removeItem("dw-auth");
    sessionStorage.removeItem("dw-user");
    navigate("/login", { replace: true });
  };

  return (
    <aside className="w-64 bg-surface border-r border-border/60 p-5 hidden md:flex md:flex-col transition-all duration-200 shadow-xl shadow-black/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col"><span className="text-xs uppercase tracking-[0.25em] text-muted">DeenWise</span><span className="text-lg font-semibold text-text">Executive Suite</span></div>
        <button
          onClick={onCollapse}
          className="h-9 w-9 rounded-md border border-border/70 text-muted hover:text-text hover:border-text transition-colors flex items-center justify-center"
          aria-label="Collapse navigation"
        >
          ‹
        </button>
      </div>
      <nav className="space-y-2 flex-1">
        {routes
          .filter((r) => r.sidebar)
          .map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              title={route.label}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive ? "bg-accent/20 text-accent" : "text-muted hover:text-text"
                }`
              }
            >
              <span className="truncate">{route.label}</span>
            </NavLink>
          ))}
      </nav>
      <div className="pt-4 border-t border-border/60">
        <button
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border/60 text-muted hover:text-text"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

