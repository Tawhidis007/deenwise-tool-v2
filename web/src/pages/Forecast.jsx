import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCampaigns, fetchCampaignForecast, fetchCampaignInputs, saveMarketingTotal } from "../api/campaigns";
import { useCurrency } from "../hooks/useCurrency";

const ForecastPage = () => {
  const { currency, setCurrency, fromBdt } = useCurrency();
  const [selectedId, setSelectedId] = React.useState(null);
  const [marketingTotal, setMarketingTotal] = React.useState("");
  const [status, setStatus] = React.useState("");
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });

  React.useEffect(() => {
    if (!selectedId && campaigns.length) setSelectedId(campaigns[0].id);
  }, [campaigns, selectedId]);

  const { data: campaignInputs } = useQuery({
    queryKey: ["campaignInputs", selectedId],
    queryFn: () => fetchCampaignInputs(selectedId),
    enabled: !!selectedId,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (campaignInputs?.campaign) {
      const val = campaignInputs.campaign.marketing_total;
      setMarketingTotal(val === null || val === undefined ? "" : val);
    }
  }, [campaignInputs]);

  const saveMarketingMut = useMutation({
    mutationFn: ({ id, marketing_cost_total_bdt }) => saveMarketingTotal({ id, marketing_cost_total_bdt }),
    onSuccess: () => {
      setStatus("Marketing total saved.");
      queryClient.invalidateQueries({ queryKey: ["campaignInputs", selectedId] });
    },
  });

  const { data: forecast } = useQuery({
    queryKey: ["campaignForecast", selectedId],
    queryFn: () => fetchCampaignForecast(selectedId),
    enabled: !!selectedId,
  });

  const totals = forecast?.totals || {
    campaign_qty: 0,
    gross_revenue: 0,
    effective_revenue: 0,
    total_cost: 0,
    net_profit: 0,
  };

  const productSummary = forecast?.product_summary || [];
  const sizeBreakdown = forecast?.size_breakdown || [];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Forecast</p>
          <h1 className="text-3xl font-semibold">Forecast</h1>
          <p className="text-muted text-sm">Analytics and outputs for your campaigns.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Display currency</label>
          <select
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="BDT">BDT</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </header>

      <section className="card space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted">Campaign</label>
            <select
              className="bg-bg border border-border rounded px-3 py-2"
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Total marketing cost (BDT)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="bg-bg border border-border rounded px-3 py-2 w-40"
              value={marketingTotal}
              onChange={(e) => {
                const val = e.target.value;
                setMarketingTotal(val);
                setStatus("");
              }}
              disabled={!selectedId || saveMarketingMut.isLoading}
            />
            <button
              className="px-3 py-2 rounded-md bg-accent text-black font-semibold disabled:opacity-50"
              disabled={!selectedId || saveMarketingMut.isLoading}
              onClick={() =>
                saveMarketingMut.mutate({
                  id: selectedId,
                  marketing_cost_total_bdt: marketingTotal === "" ? null : Number(marketingTotal),
                })
              }
            >
              Save
            </button>
          </div>
        </div>

        {status && <div className="text-sm text-accent">{status}</div>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Campaign Units" value={totals.campaign_qty?.toFixed(0)} />
          <Metric label="Gross Revenue" value={fromBdt(totals.gross_revenue || 0).toFixed(0)} />
          <Metric label="Effective Revenue" value={fromBdt(totals.effective_revenue || 0).toFixed(0)} />
          <Metric label="Total Cost" value={fromBdt(totals.total_cost || 0).toFixed(0)} />
          <Metric label="Net Profit" value={fromBdt(totals.net_profit || 0).toFixed(0)} />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Forecast Output</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-border/30 text-muted">
              <tr>
                <th className="py-2 px-3 text-left">Product</th>
                <th className="py-2 px-3 text-left">Qty</th>
                <th className="py-2 px-3 text-left">Effective Revenue</th>
                <th className="py-2 px-3 text-left">Total Cost</th>
                <th className="py-2 px-3 text-left">Net Profit</th>
                <th className="py-2 px-3 text-left">Net Margin %</th>
              </tr>
            </thead>
            <tbody>
              {productSummary.map((row) => (
                <tr key={row.product_id} className="border-b border-border/40">
                  <td className="py-2 px-3">{row.product_name}</td>
                  <td className="py-2 px-3">{row.campaign_qty}</td>
                  <td className="py-2 px-3">{fromBdt(row.effective_revenue).toFixed(0)}</td>
                  <td className="py-2 px-3">{fromBdt(row.total_cost).toFixed(0)}</td>
                  <td className="py-2 px-3">{fromBdt(row.net_profit).toFixed(0)}</td>
                  <td className="py-2 px-3">{row["net_margin_%"].toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Size Breakdown</h2>
        {sizeBreakdown && sizeBreakdown.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-border/30 text-muted">
                <tr>
                  <th className="py-2 px-3 text-left">Product</th>
                  <th className="py-2 px-3 text-left">Size</th>
                  <th className="py-2 px-3 text-left">Qty</th>
                  <th className="py-2 px-3 text-left">Effective Revenue</th>
                  <th className="py-2 px-3 text-left">Total Cost</th>
                  <th className="py-2 px-3 text-left">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {sizeBreakdown.map((row, idx) => (
                  <tr key={`${row.product_id}-${row.size}-${idx}`} className="border-b border-border/40">
                    <td className="py-2 px-3">{row.product_name}</td>
                    <td className="py-2 px-3">{row.size}</td>
                    <td className="py-2 px-3">{row.qty}</td>
                    <td className="py-2 px-3">{fromBdt(row.effective_revenue).toFixed(0)}</td>
                    <td className="py-2 px-3">{fromBdt(row.total_cost).toFixed(0)}</td>
                    <td className="py-2 px-3">{fromBdt(row.net_profit).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">No size breakdown available for this campaign.</div>
        )}
      </section>
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div className="bg-bg border border-border rounded-lg p-3">
    <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default ForecastPage;
