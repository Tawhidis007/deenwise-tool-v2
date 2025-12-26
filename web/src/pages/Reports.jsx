import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampaigns } from "../api/campaigns";
import { exportProducts, exportOpex, exportCampaign } from "../api/exports";

const downloadBase64 = (base64, filename) => {
  const link = document.createElement("a");
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  link.download = filename;
  link.click();
};

const ReportsPage = () => {
  const campaignsQuery = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });
  const [statusMsg, setStatusMsg] = React.useState("");
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("");

  React.useEffect(() => {
    if (!selectedCampaignId && campaignsQuery.data?.length) {
      setSelectedCampaignId(campaignsQuery.data[0].id);
    }
  }, [campaignsQuery.data, selectedCampaignId]);

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Product Master Export</h2>
            <p className="text-sm text-muted">Export all products to Excel.</p>
          </div>
          <button
            onClick={() => handleExport(exportProducts, "Products.xlsx")}
            className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
          >
            Download
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">OPEX Master Export</h2>
            <p className="text-sm text-muted">Export all OPEX items to Excel.</p>
          </div>
          <button
            onClick={() => handleExport(exportOpex, "OPEX_Items.xlsx")}
            className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
          >
            Download
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Export Campaign Forecast</h2>
              <p className="text-sm text-muted">Select a campaign and export its forecast to Excel.</p>
            </div>
            {campaignsQuery.isLoading ? (
              <div className="text-sm text-muted">Loading...</div>
            ) : campaignsQuery.data?.length ? (
              <div className="flex items-center gap-3">
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
                  className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
                >
                  Export
                </button>
              </div>
            ) : (
              <div className="text-sm text-muted">No campaigns found. Create one first.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReportsPage;
