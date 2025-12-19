import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCampaigns } from "../api/campaigns";
import { fetchProducts } from "../api/products";
import { fetchOpex } from "../api/opex";
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  linkScenarioCampaign,
  saveScenarioProducts,
  saveScenarioOpex,
  saveScenarioFx,
  fetchScenarioForecast,
} from "../api/scenarios";
import { useCurrency } from "../hooks/useCurrency";

const ScenarioPage = () => {
  const { currency, setCurrency, fromBdt } = useCurrency();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("products");
  const [selectedScenarioId, setSelectedScenarioId] = React.useState("");
  const [newScenario, setNewScenario] = React.useState({ name: "", description: "", base_campaign_id: "" });
  const [productOverrides, setProductOverrides] = React.useState({});
  const [opexOverrides, setOpexOverrides] = React.useState({});
  const [fxOverrides, setFxOverrides] = React.useState({ USD: null, GBP: null });
  const [statusMsg, setStatusMsg] = React.useState("");

  const { data: scenarios = [] } = useQuery({ queryKey: ["scenarios"], queryFn: fetchScenarios });
  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: opexItems = [] } = useQuery({ queryKey: ["opex"], queryFn: fetchOpex });

  React.useEffect(() => {
    if (!selectedScenarioId && scenarios.length) {
      setSelectedScenarioId(scenarios[0].id);
    }
  }, [scenarios, selectedScenarioId]);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) || null;

  const createMut = useMutation({
    mutationFn: createScenario,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setSelectedScenarioId(data.id);
      setStatusMsg("Scenario created.");
    },
  });

  const updateMut = useMutation({
    mutationFn: updateScenario,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setSelectedScenarioId(data.id);
      setStatusMsg("Scenario updated.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteScenario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setSelectedScenarioId("");
      setStatusMsg("Scenario deleted.");
    },
  });

  const linkCampMut = useMutation({
    mutationFn: linkScenarioCampaign,
    onSuccess: () => setStatusMsg("Base campaign updated."),
  });

  const saveProdMut = useMutation({
    mutationFn: () => {
      if (!selectedScenarioId) return;
      const rows = Object.values(productOverrides).map((ov) => ({
        product_id: ov.product_id,
        price_override: ov.use_price ? Number(ov.price_override || 0) : null,
        discount_override: ov.use_discount ? Number(ov.discount_override || 0) : null,
        return_rate_override: ov.use_return ? Number(ov.return_rate_override || 0) : null,
        cost_override: ov.use_cost ? Number(ov.cost_override || 0) : null,
        qty_override: ov.use_qty ? Number(ov.qty_override || 0) : null,
      }));
      return saveScenarioProducts({ id: selectedScenarioId, rows });
    },
    onSuccess: () => setStatusMsg("Product overrides saved."),
  });

  const saveOpexMut = useMutation({
    mutationFn: () => {
      if (!selectedScenarioId) return;
      const rows = Object.values(opexOverrides).map((ov) => ({
        opex_item_id: ov.opex_item_id,
        cost_override: ov.use_override ? Number(ov.cost_override || 0) : null,
      }));
      return saveScenarioOpex({ id: selectedScenarioId, rows });
    },
    onSuccess: () => setStatusMsg("OPEX overrides saved."),
  });

  const saveFxMut = useMutation({
    mutationFn: () => {
      if (!selectedScenarioId) return;
      const rows = [
        { currency: "USD", rate: fxOverrides.USD || 117 },
        { currency: "GBP", rate: fxOverrides.GBP || 146 },
      ];
      return saveScenarioFx({ id: selectedScenarioId, rows });
    },
    onSuccess: () => setStatusMsg("FX overrides saved."),
  });

  const forecastQuery = useQuery({
    queryKey: ["scenarioForecast", selectedScenarioId],
    queryFn: () => fetchScenarioForecast(selectedScenarioId),
    enabled: Boolean(selectedScenarioId),
  });

  const handleCreate = () => {
    if (!newScenario.name) {
      setStatusMsg("Give scenario a name.");
      return;
    }
    createMut.mutate({
      name: newScenario.name,
      description: newScenario.description,
      base_campaign_id: newScenario.base_campaign_id || campaigns[0]?.id,
    });
  };

  const handleDelete = () => {
    if (!selectedScenarioId) return;
    deleteMut.mutate(selectedScenarioId);
  };

  const handleLinkCampaign = (campaignId) => {
    if (!selectedScenarioId) return;
    linkCampMut.mutate({ id: selectedScenarioId, campaign_id: campaignId });
  };

  const baseCampaignId = selectedScenario?.base_campaign_id || campaigns[0]?.id || "";

  const productCards = products.map((p) => {
    const ov = productOverrides[p.id] || { product_id: p.id };
    const basePrice = fromBdt(p.price_bdt || 0);
    const baseDisc = (p.discount_rate || 0) * 100;
    const baseRet = (p.return_rate || 0) * 100;
    const baseCost = fromBdt(
      (p.manufacturing_cost_bdt || 0) +
        (p.packaging_cost_bdt || 0) +
        (p.shipping_cost_bdt || 0) +
        (p.marketing_cost_bdt || 0)
    );

    return (
      <div key={p.id} className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-muted">{p.category}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <OverrideInput
            label={`Price (${currency})`}
            value={ov.price_override || ""}
            checked={ov.use_price || false}
            onCheck={(checked) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, use_price: checked } }))
            }
            onChange={(val) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, price_override: val } }))
            }
          />
          <OverrideInput
            label="Discount (%)"
            value={ov.discount_override || ""}
            checked={ov.use_discount || false}
            onCheck={(checked) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, use_discount: checked } }))
            }
            onChange={(val) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, discount_override: val } }))
            }
          />
          <OverrideInput
            label="Return (%)"
            value={ov.return_rate_override || ""}
            checked={ov.use_return || false}
            onCheck={(checked) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, use_return: checked } }))
            }
            onChange={(val) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, return_rate_override: val } }))
            }
          />
          <OverrideInput
            label={`Cost Override (${currency})`}
            value={ov.cost_override || ""}
            checked={ov.use_cost || false}
            onCheck={(checked) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, use_cost: checked } }))
            }
            onChange={(val) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, cost_override: val } }))
            }
          />
          <OverrideInput
            label="Qty Override"
            value={ov.qty_override || ""}
            checked={ov.use_qty || false}
            onCheck={(checked) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, use_qty: checked } }))
            }
            onChange={(val) =>
              setProductOverrides((prev) => ({ ...prev, [p.id]: { ...ov, product_id: p.id, qty_override: val } }))
            }
          />
        </div>
        <div className="text-xs text-muted">
          Base: Price {basePrice.toFixed(2)}, Discount {baseDisc.toFixed(1)}%, Return {baseRet.toFixed(1)}%, Unit Cost {baseCost.toFixed(2)}
        </div>
      </div>
    );
  });

  const opexCards = opexItems.map((o) => {
    const ov = opexOverrides[o.id] || { opex_item_id: o.id };
    return (
      <div key={o.id} className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{o.name}</div>
            <div className="text-xs text-muted">{o.category}</div>
          </div>
          <div className="text-sm text-muted">Base: {fromBdt(o.cost_bdt || 0).toFixed(0)} {currency}</div>
        </div>
        <OverrideInput
          label={`Override Cost (${currency})`}
          value={ov.cost_override || ""}
          checked={ov.use_override || false}
          onCheck={(checked) =>
            setOpexOverrides((prev) => ({ ...prev, [o.id]: { ...ov, opex_item_id: o.id, use_override: checked } }))
          }
          onChange={(val) =>
            setOpexOverrides((prev) => ({ ...prev, [o.id]: { ...ov, opex_item_id: o.id, cost_override: val } }))
          }
        />
      </div>
    );
  });

  const forecast = forecastQuery.data;
  const totals = forecast?.totals || {
    campaign_qty: 0,
    gross_revenue: 0,
    effective_revenue: 0,
    total_cost: 0,
    net_profit_variable: 0,
    opex_total: 0,
    net_profit_after_opex: 0,
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Scenario</p>
          <h1 className="text-3xl font-semibold">Scenario Planning</h1>
          <p className="text-muted text-sm">Create what-if scenarios tied to campaigns with product, OPEX, and FX overrides.</p>
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

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card space-y-3">
          <h3 className="text-xl font-semibold">Scenarios</h3>
          {scenarios.length === 0 ? (
            <div className="muted">No scenarios yet. Create one below.</div>
          ) : (
            <select
              className="w-full bg-bg border border-border rounded px-3 py-2"
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {selectedScenario && (
            <div className="space-y-1 text-sm text-muted">
              <div>Description: {selectedScenario.description || "(none)"}</div>
              <div>Base Campaign: {baseCampaignId || "(none)"}</div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="bg-border text-text px-3 py-2 rounded-md text-sm"
              disabled={!selectedScenarioId || deleteMut.isLoading}
            >
              Delete Scenario
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 card space-y-4">
          <h3 className="text-xl font-semibold">Create Scenario</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Name" value={newScenario.name} onChange={(v) => setNewScenario((p) => ({ ...p, name: v }))} />
            <Input label="Base Campaign" value={newScenario.base_campaign_id} onChange={(v) => setNewScenario((p) => ({ ...p, base_campaign_id: v }))} placeholder="campaign id" />
            <Input label="Description" value={newScenario.description} onChange={(v) => setNewScenario((p) => ({ ...p, description: v }))} />
          </div>
          <button
            onClick={handleCreate}
            className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            disabled={createMut.isLoading}
          >
            Create Scenario
          </button>
        </div>
      </section>

      <div className="flex gap-2">
        <TabButton id="products" label="Product Overrides" active={activeTab} setActive={setActiveTab} />
        <TabButton id="opex" label="OPEX Overrides" active={activeTab} setActive={setActiveTab} />
        <TabButton id="fx" label="FX Overrides" active={activeTab} setActive={setActiveTab} />
        <TabButton id="results" label="Scenario Results" active={activeTab} setActive={setActiveTab} />
      </div>

      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">Base Campaign: {baseCampaignId || "(none)"}</div>
            {selectedScenario && (
              <select
                className="bg-bg border border-border rounded px-3 py-2 text-sm"
                value={baseCampaignId}
                onChange={(e) => handleLinkCampaign(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {products.length === 0 ? (
            <div className="muted">No products available.</div>
          ) : (
            <div className="space-y-3">
              {productCards}
            </div>
          )}
          <button
            onClick={() => saveProdMut.mutate()}
            className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            disabled={!selectedScenarioId || saveProdMut.isLoading}
          >
            Save Product Overrides
          </button>
        </div>
      )}

      {activeTab === "opex" && (
        <div className="space-y-3">
          {opexItems.length === 0 ? (
            <div className="muted">No OPEX items found. Add items first.</div>
          ) : (
            <div className="space-y-3">
              {opexCards}
            </div>
          )}
          <button
            onClick={() => saveOpexMut.mutate()}
            className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            disabled={!selectedScenarioId || saveOpexMut.isLoading}
          >
            Save OPEX Overrides
          </button>
        </div>
      )}

      {activeTab === "fx" && (
        <div className="space-y-4">
          {["USD", "GBP"].map((ccy) => (
            <div key={ccy} className="border border-border rounded-lg p-4 flex items-center gap-3">
              <div className="flex-1">
                <label className="text-sm text-muted">{ccy} rate override (BDT per {ccy})</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                  value={fxOverrides[ccy] || ""}
                  onChange={(e) => setFxOverrides((p) => ({ ...p, [ccy]: Number(e.target.value) }))}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => saveFxMut.mutate()}
            className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
            disabled={!selectedScenarioId || saveFxMut.isLoading}
          >
            Save FX Overrides
          </button>
        </div>
      )}

      {activeTab === "results" && (
        <div className="space-y-4">
          {!selectedScenarioId ? (
            <div className="muted">Select a scenario.</div>
          ) : forecastQuery.isLoading ? (
            <div className="loading">Loading...</div>
          ) : forecastQuery.error ? (
            <div className="muted">Failed to load scenario results.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 card">
                <Metric label="Scenario Units" value={totals.campaign_qty?.toFixed(0)} />
                <Metric label="Gross Revenue" value={fromBdt(totals.gross_revenue || 0).toFixed(0)} />
                <Metric label="Effective Revenue" value={fromBdt(totals.effective_revenue || 0).toFixed(0)} />
                <Metric label="Variable Profit" value={fromBdt(totals.net_profit_variable || 0).toFixed(0)} />
                <Metric label="Total OPEX" value={fromBdt(totals.opex_total || 0).toFixed(0)} />
                <Metric label="Net Profit After OPEX" value={fromBdt(totals.net_profit_after_opex || 0).toFixed(0)} />
              </div>

              <div className="card">
                <h3 className="text-xl font-semibold mb-3">Product-Level Outcome</h3>
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
                      {(forecast?.product_summary || []).map((row) => (
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

              <div className="card">
                <h3 className="text-xl font-semibold mb-3">Monthly Outcome</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-border/30 text-muted">
                      <tr>
                        <th className="py-2 px-3 text-left">Month</th>
                        <th className="py-2 px-3 text-left">Qty</th>
                        <th className="py-2 px-3 text-left">Effective Revenue</th>
                        <th className="py-2 px-3 text-left">Total Cost</th>
                        <th className="py-2 px-3 text-left">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forecast?.monthly || []).map((row, idx) => (
                        <tr key={`${row.month}-${idx}`} className="border-b border-border/40">
                          <td className="py-2 px-3">{row.month_nice || row.month}</td>
                          <td className="py-2 px-3">{row.qty}</td>
                          <td className="py-2 px-3">{fromBdt(row.effective_revenue).toFixed(0)}</td>
                          <td className="py-2 px-3">{fromBdt(row.total_cost).toFixed(0)}</td>
                          <td className="py-2 px-3">{fromBdt(row.net_profit).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const TabButton = ({ id, label, active, setActive }) => (
  <button
    onClick={() => setActive(id)}
    className={`px-4 py-2 rounded-md border text-sm ${
      active === id ? "border-accent text-accent" : "border-border text-muted hover:text-text"
    }`}
  >
    {label}
  </button>
);

const Input = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-sm text-muted">{label}</label>
    <input
      className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const OverrideInput = ({ label, value, checked, onCheck, onChange }) => (
  <div className="space-y-1">
    <label className="text-xs text-muted block">{label}</label>
    <div className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
      <input
        className="flex-1 bg-bg border border-border rounded px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

const Metric = ({ label, value }) => (
  <div className="bg-bg border border-border rounded-lg p-3">
    <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default ScenarioPage;
