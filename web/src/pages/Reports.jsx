import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampaigns } from "../api/campaigns";
import { fetchScenarios } from "../api/scenarios";
import { exportProducts, exportOpex, exportCampaign, exportScenario } from "../api/exports";

const downloadBase64 = (base64, filename) => {
  const link = document.createElement("a");
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  link.download = filename;
  link.click();
};

const ReportsPage = () => {
  const campaignsQuery = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });
  const scenariosQuery = useQuery({ queryKey: ["scenarios"], queryFn: fetchScenarios });
  const [statusMsg, setStatusMsg] = React.useState("");
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("");
  const [selectedScenarioId, setSelectedScenarioId] = React.useState("");

  React.useEffect(() => {
    if (!selectedCampaignId && campaignsQuery.data?.length) {
      setSelectedCampaignId(campaignsQuery.data[0].id);
    }
  }, [campaignsQuery.data, selectedCampaignId]);

  React.useEffect(() => {
    if (!selectedScenarioId && scenariosQuery.data?.length) {
      setSelectedScenarioId(scenariosQuery.data[0].id);
    }
  }, [scenariosQuery.data, selectedScenarioId]);

  const handleExport = async (fn, name) => {
    try {
      setStatusMsg("Preparing export...");
      const res = await fn();
      downloadBase64(res.file, res.file_name || name);
      setStatusMsg("Download ready.");
    } catch (err) {
      setStatusMsg("Export failed.");
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-accent">Reports</p>
        <h1 className="text-3xl font-semibold">Reports & Exports</h1>
        <p className="text-muted text-sm">Download campaign, scenario, product, and OPEX reports as Excel files.</p>
      </header>

      {statusMsg && <div className="text-sm text-accent">{statusMsg}</div>}

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Product Master Export</h2>
        <button
          onClick={() => handleExport(exportProducts, "Products.xlsx")}
          className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
        >
          Download Product Master (Excel)
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">OPEX Master Export</h2>
        <button
          onClick={() => handleExport(exportOpex, "OPEX_Items.xlsx")}
          className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
        >
          Download OPEX Master (Excel)
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Export Campaign Forecast</h2>
        {campaignsQuery.isLoading ? (
          <div className="loading">Loading campaigns...</div>
        ) : campaignsQuery.data?.length ? (
          <div className="space-y-3">
            <select
              className="bg-bg border border-border rounded px-3 py-2"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              {campaignsQuery.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleExport(() => exportCampaign(selectedCampaignId), "campaign.xlsx")}
              className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            >
              Export Campaign as Excel
            </button>
          </div>
        ) : (
          <div className="muted">No campaigns found. Create one in the Forecast Dashboard.</div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Scenario Reports Export</h2>
        {scenariosQuery.isLoading ? (
          <div className="loading">Loading scenarios...</div>
        ) : scenariosQuery.data?.length ? (
          <div className="space-y-3">
            <select
              className="bg-bg border border-border rounded px-3 py-2"
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
            >
              {scenariosQuery.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleExport(() => exportScenario(selectedScenarioId), "scenario.xlsx")}
              className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            >
              Generate Scenario Excel Report
            </button>
          </div>
        ) : (
          <div className="muted">No scenarios found.</div>
        )}
      </section>
    </div>
  );
};

export default ReportsPage;
