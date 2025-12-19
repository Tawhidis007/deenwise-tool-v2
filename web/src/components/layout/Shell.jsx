import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const Shell = () => {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="min-h-screen bg-bg text-text flex relative">
      {!collapsed && <Sidebar onCollapse={() => setCollapsed(true)} />}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed bottom-6 left-6 h-12 w-12 rounded-full shadow-lg bg-accent text-black font-bold"
          aria-label="Open navigation"
        >
          ☰
        </button>
      )}
    </div>
  );
};

export default Shell;
