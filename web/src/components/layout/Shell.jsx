import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const Shell = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("dw-ui-theme") || "premium";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text flex relative">
      {!collapsed && <Sidebar onCollapse={() => setCollapsed(true)} />}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed bottom-6 left-6 h-11 w-11 rounded-full shadow-lg bg-accent text-bg text-xs tracking-wide"
          aria-label="Open navigation"
        >
          ☰
        </button>
      )}
    </div>
  );
};

export default Shell;

