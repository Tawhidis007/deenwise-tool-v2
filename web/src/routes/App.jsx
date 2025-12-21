import React from "react";
import { Route, Routes } from "react-router-dom";
import Shell from "../components/layout/Shell";
import AuthGuard from "../components/AuthGuard";
import DashboardPage from "../pages/Dashboard";
import LoginPage from "../pages/Login";
import ProductsPage from "../pages/Products";
import CampaignsPage from "../pages/Campaigns";
import ForecastPage from "../pages/Forecast";
import OpexPage from "../pages/Opex";
import ScenarioPage from "../pages/Scenario";
import SettingsPage from "../pages/Settings";
import ReportsPage from "../pages/Reports";
import { routes } from "./routes";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/opex" element={<OpexPage />} />
          <Route path="/scenarios" element={<ScenarioPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          {routes
            .filter((r) => !["/products", "/campaigns", "/forecast", "/opex", "/scenarios", "/settings", "/reports"].includes(r.path))
            .map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<div className="text-muted">Coming soon</div>}
              />
            ))}
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
