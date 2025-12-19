import React from "react";
import { NavLink } from "react-router-dom";
import { routes } from "../../routes/routes";

const Sidebar = ({ onCollapse }) => {
  return (
    <aside className="w-64 bg-surface border-r border-border p-4 hidden md:flex md:flex-col transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">DeenWise</div>
        <button
          onClick={onCollapse}
          className="h-9 w-9 rounded-md border border-border text-muted hover:text-text hover:border-text transition-colors flex items-center justify-center"
          aria-label="Collapse navigation"
        >
          ‹
        </button>
      </div>
      <nav className="space-y-2">
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
    </aside>
  );
};

export default Sidebar;
