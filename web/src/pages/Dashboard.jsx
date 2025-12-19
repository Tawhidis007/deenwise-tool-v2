import React from "react";
import { Link } from "react-router-dom";

const DashboardPage = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted">Welcome. Choose a module from the sidebar.</p>
      <div className="space-x-3">
        <Link to="/products" className="text-accent hover:underline">
          Go to Products
        </Link>
      </div>
    </div>
  );
};

export default DashboardPage;
