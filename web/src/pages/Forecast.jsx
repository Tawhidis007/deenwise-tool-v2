import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  fetchCampaignInputs,
  saveCampaignQuantities,
  saveProductMonthWeights,
  saveSizeBreakdown,
  fetchCampaignForecast,
} from "../api/campaigns";
import { fetchProducts } from "../api/products";
import { useCurrency } from "../hooks/useCurrency";

const monthRange = (start, end) => {
  if (!start || !end) return [];
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const startDate = s <= e ? s : e;
  const endDate = s <= e ? e : s;
  const months = [];
  let y = startDate.getFullYear();
  let m = startDate.getMonth() + 1;
  while (y < endDate.getFullYear() || (y === endDate.getFullYear() && m <= endDate.getMonth() + 1)) {
    months.push(`${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
};

const niceMonth = (label) => {
  const [y, m] = label.split("-").map(Number);
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]} ${y}`;
};

const ForecastPage = () => {
  const { currency, setCurrency, fromBdt } = useCurrency();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [newCamp, setNewCamp] = React.useState({
    name: "",
    start_date: "2026-02-01",
    end_date: "2026-04-01",
    distribution_mode: "Uniform",
  });
  const [selectedProducts, setSelectedProducts] = React.useState([]);
  const [quantities, setQuantities] = React.useState({});
  const [perProductWeights, setPerProductWeights] = React.useState({});
  const [sizeEnabled, setSizeEnabled] = React.useState(false);
  const [sizes, setSizes] = React.useState({});
  const [statusMsg, setStatusMsg] = React.useState("");

  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });

  React.useEffect(() => {
    if (!selectedCampaign && campaigns.length) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  const { data: inputs } = useQuery({
    queryKey: ["campaignInputs", selectedCampaign?.id],
    queryFn: () => fetchCampaignInputs(selectedCampaign.id),
    enabled: !!selectedCampaign,
  });

  React.useEffect(() => {
    if (!inputs || !products.length) return;
    const initialSelected = inputs.quantities && Object.keys(inputs.quantities).length
      ? Object.keys(inputs.quantities)
      : products.map((p) => p.id);
    setSelectedProducts(initialSelected);
    setQuantities(inputs.quantities || {});
    setPerProductWeights(inputs.product_month_weights || {});
    setSizes(inputs.size_breakdown || {});
    setSizeEnabled(Boolean(inputs.size_breakdown && Object.keys(inputs.size_breakdown).length));
  }, [inputs, products]);

  const createCampMut = useMutation({
    mutationFn: createCampaign,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setSelectedCampaign(data);
      setStatusMsg("Campaign created.");
    },
  });

  const updateCampMut = useMutation({
    mutationFn: updateCampaign,
    onSuccess: (data) => {
      setSelectedCampaign(data);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaignInputs", data.id] });
    },
  });

  const saveQuantMut = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) return;
      const id = selectedCampaign.id;
      await saveCampaignQuantities({ id, quantities });
      if (selectedCampaign.distribution_mode === "Custom") {
        await saveProductMonthWeights({ id, weights: perProductWeights });
      }
      if (sizeEnabled) {
        await saveSizeBreakdown({ id, sizes });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaignForecast", selectedCampaign?.id] });
      setStatusMsg("Saved to Supabase.");
    },
  });

  const { data: forecast } = useQuery({
    queryKey: ["campaignForecast", selectedCampaign?.id],
    queryFn: () => fetchCampaignForecast(selectedCampaign.id),
    enabled: !!selectedCampaign,
  });

  const months = selectedCampaign ? monthRange(selectedCampaign.start_date, selectedCampaign.end_date) : [];

  const toggleProduct = (id) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const setQty = (id, val) => {
    const num = Number(val || 0);
    setQuantities((prev) => ({ ...prev, [id]: num }));
  };

  const setWeight = (pid, month, val) => {
    const num = Number(val || 0);
    setPerProductWeights((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] || {}), [month]: num },
    }));
  };

  const setSize = (pid, size, val) => {
    const num = Number(val || 0);
    setSizes((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] || {}), [size]: num },
    }));
  };

  const createCampaignHandler = () => {
    if (!newCamp.name) {
      setStatusMsg("Please provide a name for the campaign.");
      return;
    }
    createCampMut.mutate({
      name: newCamp.name,
      start_date: newCamp.start_date,
      end_date: newCamp.end_date,
      distribution_mode: newCamp.distribution_mode,
      currency,
    });
  };

  const changeCampaign = (id) => {
    const camp = campaigns.find((c) => c.id === id);
    if (camp) setSelectedCampaign(camp);
  };

  const totals = forecast?.totals || {
    campaign_qty: 0,
    gross_revenue: 0,
    effective_revenue: 0,
    total_cost: 0,
    net_profit: 0,
  };

  const productSummary = forecast?.product_summary || [];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Forecast</p>
          <h1 className="text-3xl font-semibold">Forecast Dashboard</h1>
          <p className="text-muted text-sm">Plan campaign quantities and see revenue forecasts saved to Supabase.</p>
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

      {statusMsg && <div className="text-sm text-accent">{statusMsg}</div>}

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card space-y-3">
          <h3 className="text-xl font-semibold">Active Campaign</h3>
          <select
            className="w-full bg-bg border border-border rounded px-3 py-2"
            value={selectedCampaign?.id || ""}
            onChange={(e) => changeCampaign(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {selectedCampaign && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm text-muted">Start</label>
                  <input
                    type="date"
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={selectedCampaign.start_date?.slice(0, 10) || ""}
                    onChange={(e) => updateCampMut.mutate({ id: selectedCampaign.id, payload: { start_date: e.target.value } })}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted">End</label>
                  <input
                    type="date"
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={selectedCampaign.end_date?.slice(0, 10) || ""}
                    onChange={(e) => updateCampMut.mutate({ id: selectedCampaign.id, payload: { end_date: e.target.value } })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted">Distribution Mode</label>
                <select
                  className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                  value={selectedCampaign.distribution_mode}
                  onChange={(e) => updateCampMut.mutate({ id: selectedCampaign.id, payload: { distribution_mode: e.target.value } })}
                >
                  <option value="Uniform">Uniform</option>
                  <option value="Front-loaded">Front-loaded</option>
                  <option value="Back-loaded">Back-loaded</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sizeEnabled}
                  onChange={(e) => setSizeEnabled(e.target.checked)}
                  id="sizeToggle"
                  className="h-4 w-4"
                />
                <label htmlFor="sizeToggle" className="text-sm text-muted">
                  Enable size breakdown
                </label>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-3 card space-y-4">
          <h3 className="text-xl font-semibold">Create New Campaign</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              className="bg-bg border border-border rounded px-3 py-2"
              placeholder="Name"
              value={newCamp.name}
              onChange={(e) => setNewCamp((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              type="date"
              className="bg-bg border border-border rounded px-3 py-2"
              value={newCamp.start_date}
              onChange={(e) => setNewCamp((p) => ({ ...p, start_date: e.target.value }))}
            />
            <input
              type="date"
              className="bg-bg border border-border rounded px-3 py-2"
              value={newCamp.end_date}
              onChange={(e) => setNewCamp((p) => ({ ...p, end_date: e.target.value }))}
            />
            <select
              className="bg-bg border border-border rounded px-3 py-2"
              value={newCamp.distribution_mode}
              onChange={(e) => setNewCamp((p) => ({ ...p, distribution_mode: e.target.value }))}
            >
              <option value="Uniform">Uniform</option>
              <option value="Front-loaded">Front-loaded</option>
              <option value="Back-loaded">Back-loaded</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <button
            onClick={createCampaignHandler}
            className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            disabled={createCampMut.isLoading}
          >
            Create Campaign
          </button>
        </div>
      </section>

      {!products.length ? (
        <div className="muted">No products found. Add products first.</div>
      ) : !selectedCampaign ? (
        <div className="muted">Create or select a campaign to begin.</div>
      ) : (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Quantities</h2>
              <div className="text-sm text-muted">{months.map(niceMonth).join(", ") || "No months"}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>

            {selectedProducts.length === 0 ? (
              <div className="muted">Select at least one product.</div>
            ) : (
              <div className="space-y-4">
                {selectedProducts.map((pid) => {
                  const prod = products.find((p) => p.id === pid);
                  if (!prod) return null;
                  return (
                    <div key={pid} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold">{prod.name}</div>
                          <div className="text-xs text-muted">{prod.category}</div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="bg-bg border border-border rounded px-3 py-2 w-32"
                          value={quantities[pid] || 0}
                          onChange={(e) => setQty(pid, e.target.value)}
                        />
                      </div>

                      {selectedCampaign.distribution_mode === "Custom" && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {months.map((m, idx) => (
                            <div key={m}>
                              <label className="text-xs text-muted">{niceMonth(m)}</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="mt-1 w-full bg-bg border border-border rounded px-2 py-1 text-sm"
                                value={(perProductWeights[pid]?.[m] ?? (idx === months.length - 1 ? 0 : 0))}
                                onChange={(e) => setWeight(pid, m, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {sizeEnabled && (
                        <div className="mt-3">
                          <div className="text-xs text-muted mb-2">Size breakdown</div>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {["XS","S","M","L","XL","XXL"].map((s) => (
                              <div key={s}>
                                <label className="text-xs text-muted">{s}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="mt-1 w-full bg-bg border border-border rounded px-2 py-1 text-sm"
                                  value={sizes[pid]?.[s] || 0}
                                  onChange={(e) => setSize(pid, s, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => saveQuantMut.mutate()}
              className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
              disabled={saveQuantMut.isLoading}
            >
              Save
            </button>
          </div>

          <div className="card space-y-3">
            <h2 className="text-xl font-semibold">Forecast Output</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="Campaign Units" value={totals.campaign_qty?.toFixed(0)} />
              <Metric label="Gross Revenue" value={fromBdt(totals.gross_revenue || 0).toFixed(0)} />
              <Metric label="Effective Revenue" value={fromBdt(totals.effective_revenue || 0).toFixed(0)} />
              <Metric label="Total Cost" value={fromBdt(totals.total_cost || 0).toFixed(0)} />
              <Metric label="Net Profit" value={fromBdt(totals.net_profit || 0).toFixed(0)} />
            </div>

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
          </div>

          <div className="card space-y-3">
            <h2 className="text-xl font-semibold">Size Breakdown</h2>
            {!sizeEnabled ? (
              <div className="muted">Enable size breakdown to use this.</div>
            ) : forecast?.size_breakdown && forecast.size_breakdown.length ? (
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
                    {forecast.size_breakdown.map((row, idx) => (
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
              <div className="muted">Input size quantities in Quantities tab.</div>
            )}
          </div>
        </div>
      )}
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
