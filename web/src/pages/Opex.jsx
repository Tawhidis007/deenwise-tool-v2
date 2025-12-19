import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCampaigns } from "../api/campaigns";
import {
  fetchOpex,
  createOpex,
  updateOpex,
  deleteOpex,
  saveCampaignOpex,
  fetchCampaignProfitability,
} from "../api/opex";
import { useCurrency } from "../hooks/useCurrency";

const emptyForm = {
  name: "",
  category: "",
  cost_bdt: 0,
  start_month: "",
  end_month: "",
  is_one_time: false,
  notes: "",
};

const OpexPage = () => {
  const { currency, setCurrency, fromBdt } = useCurrency();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("items");
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);
  const [selectedOpexId, setSelectedOpexId] = React.useState("");
  const [selectedOpexLinks, setSelectedOpexLinks] = React.useState([]);
  const [statusMsg, setStatusMsg] = React.useState("");

  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });
  const { data: opexItems = [] } = useQuery({ queryKey: ["opex"], queryFn: fetchOpex });

  React.useEffect(() => {
    if (!selectedCampaignId && campaigns.length) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const profitabilityQuery = useQuery({
    queryKey: ["profitability", selectedCampaignId],
    queryFn: () => fetchCampaignProfitability(selectedCampaignId),
    enabled: Boolean(selectedCampaignId),
  });

  React.useEffect(() => {
    if (!selectedOpexId && opexItems.length) {
      setSelectedOpexId(opexItems[0].id);
    }
  }, [opexItems, selectedOpexId]);

  const createMut = useMutation({
    mutationFn: createOpex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opex"] });
      setForm(emptyForm);
      setStatusMsg("OPEX item added.");
    },
  });

  const updateMut = useMutation({
    mutationFn: updateOpex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opex"] });
      setStatusMsg("Updated OPEX item.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteOpex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opex"] });
      setSelectedOpexId("");
      setForm(emptyForm);
      setStatusMsg("Deleted OPEX item.");
    },
  });

  const saveLinksMut = useMutation({
    mutationFn: () => saveCampaignOpex({ campaignId: selectedCampaignId, opexIds: selectedOpexLinks }),
    onSuccess: () => setStatusMsg("Campaign OPEX selection saved."),
  });

  const validate = (body) => {
    const errors = [];
    ["name", "category", "cost_bdt", "start_month"].forEach((f) => {
      if (!body[f] && body[f] !== 0) errors.push(`Missing required field: ${f}`);
    });
    if (body.cost_bdt !== undefined) {
      const num = Number(body.cost_bdt);
      if (Number.isNaN(num)) errors.push("cost_bdt must be a number");
      if (num < 0) errors.push("cost_bdt cannot be negative");
    }
    return errors;
  };

  const handleCreate = () => {
    const payload = {
      ...form,
      cost_bdt: Number(form.cost_bdt || 0),
      end_month: form.end_month || null,
      is_one_time: Boolean(form.is_one_time),
    };
    const errors = validate(payload);
    if (errors.length) return setStatusMsg(errors.join("; "));
    createMut.mutate(payload);
  };

  const handleUpdate = () => {
    if (!selectedOpexId) return;
    const payload = {
      ...form,
      cost_bdt: Number(form.cost_bdt || 0),
      end_month: form.end_month || null,
      is_one_time: Boolean(form.is_one_time),
    };
    const errors = validate(payload);
    if (errors.length) return setStatusMsg(errors.join("; "));
    updateMut.mutate({ id: selectedOpexId, payload });
  };

  const handleDelete = () => {
    if (!selectedOpexId) return;
    deleteMut.mutate(selectedOpexId);
  };

  const selectForEdit = (id) => {
    const row = opexItems.find((o) => o.id === id);
    if (!row) return;
    setSelectedOpexId(id);
    setForm({
      name: row.name || "",
      category: row.category || "",
      cost_bdt: row.cost_bdt || 0,
      start_month: row.start_month || "",
      end_month: row.end_month || "",
      is_one_time: Boolean(row.is_one_time),
      notes: row.notes || "",
    });
  };

  const profitability = profitabilityQuery.data;
  const monthly = profitability?.monthly || [];
  const totals = profitability?.totals || {
    campaign_qty: 0,
    gross_revenue: 0,
    effective_revenue: 0,
    net_profit_variable: 0,
    total_opex: 0,
    net_profit_after_opex: 0,
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">OPEX</p>
          <h1 className="text-3xl font-semibold">OPEX & Profitability</h1>
          <p className="text-muted text-sm">Manage global OPEX, attach to campaigns, and see profitability after OPEX.</p>
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

      <div className="flex gap-2">
        <TabButton id="items" active={activeTab} setActive={setActiveTab} label="OPEX Items" />
        <TabButton id="attach" active={activeTab} setActive={setActiveTab} label="Attach to Campaign" />
        <TabButton id="profit" active={activeTab} setActive={setActiveTab} label="Profitability View" />
      </div>

      {activeTab === "items" && (
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Global OPEX Items</h2>
              <span className="text-sm text-muted">{opexItems.length} items</span>
            </div>
            {opexItems.length === 0 ? (
              <div className="muted">No OPEX items yet. Add your first one below.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-border/30 text-muted">
                    <tr>
                      <th className="py-2 px-3 text-left">Name</th>
                      <th className="py-2 px-3 text-left">Category</th>
                      <th className="py-2 px-3 text-left">Cost</th>
                      <th className="py-2 px-3 text-left">Start</th>
                      <th className="py-2 px-3 text-left">End</th>
                      <th className="py-2 px-3 text-left">One-time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opexItems.map((o) => (
                      <tr key={o.id} className="border-b border-border/40">
                        <td className="py-2 px-3">{o.name}</td>
                        <td className="py-2 px-3 text-muted">{o.category}</td>
                        <td className="py-2 px-3">{fromBdt(o.cost_bdt || 0).toFixed(0)}</td>
                        <td className="py-2 px-3 text-muted">{o.start_month}</td>
                        <td className="py-2 px-3 text-muted">{o.end_month || ""}</td>
                        <td className="py-2 px-3 text-muted">{o.is_one_time ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card space-y-4">
            <h3 className="text-xl font-semibold">Add New OPEX Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Name*" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
              <Input label="Category*" value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
              <Input
                label={`Cost (${currency})*`}
                type="number"
                value={form.cost_bdt}
                onChange={(v) => setForm((p) => ({ ...p, cost_bdt: v }))}
              />
              <Input label="Start month (YYYY-MM)*" value={form.start_month} onChange={(v) => setForm((p) => ({ ...p, start_month: v }))} />
              <Input label="End month (optional)" value={form.end_month} onChange={(v) => setForm((p) => ({ ...p, end_month: v }))} />
              <div className="flex items-center gap-2 mt-6">
                <input
                  id="oneTime"
                  type="checkbox"
                  checked={form.is_one_time}
                  onChange={(e) => setForm((p) => ({ ...p, is_one_time: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="oneTime" className="text-sm text-muted">One-time cost?</label>
              </div>
            </div>
            <textarea
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
              rows={3}
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button
              onClick={handleCreate}
              className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
              disabled={createMut.isLoading}
            >
              Add OPEX
            </button>
          </section>

          {opexItems.length > 0 && (
            <section className="card space-y-4">
              <h3 className="text-xl font-semibold">Edit / Delete OPEX Item</h3>
              <select
                className="bg-bg border border-border rounded px-3 py-2 w-full"
                value={selectedOpexId}
                onChange={(e) => selectForEdit(e.target.value)}
              >
                <option value="" disabled>
                  Choose item
                </option>
                {opexItems.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>

              {selectedOpexId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Name*" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
                  <Input label="Category*" value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
                  <Input
                    label={`Cost (${currency})*`}
                    type="number"
                    value={form.cost_bdt}
                    onChange={(v) => setForm((p) => ({ ...p, cost_bdt: v }))}
                  />
                  <Input label="Start month*" value={form.start_month} onChange={(v) => setForm((p) => ({ ...p, start_month: v }))} />
                  <Input label="End month" value={form.end_month} onChange={(v) => setForm((p) => ({ ...p, end_month: v }))} />
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      id="oneTimeEdit"
                      type="checkbox"
                      checked={form.is_one_time}
                      onChange={(e) => setForm((p) => ({ ...p, is_one_time: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <label htmlFor="oneTimeEdit" className="text-sm text-muted">One-time cost?</label>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleUpdate}
                  className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
                  disabled={!selectedOpexId || updateMut.isLoading}
                >
                  Save changes
                </button>
                <button
                  onClick={handleDelete}
                  className="bg-border text-text px-4 py-2 rounded-md font-semibold"
                  disabled={!selectedOpexId || deleteMut.isLoading}
                >
                  Delete item
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "attach" && (
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold">Attach OPEX to Campaign</h2>
          {!selectedCampaignId ? (
            <div className="muted">Select a campaign first.</div>
          ) : opexItems.length === 0 ? (
            <div className="muted">No OPEX items exist yet. Create them first.</div>
          ) : (
            <>
              <div>
                <label className="text-sm text-muted block mb-2">OPEX included in this campaign</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {opexItems.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedOpexLinks.includes(o.id)}
                        onChange={() =>
                          setSelectedOpexLinks((prev) =>
                            prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id]
                          )
                        }
                      />
                      <span>{o.name} - {o.category}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={() => saveLinksMut.mutate()}
                className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
                disabled={saveLinksMut.isLoading}
              >
                Save Selection
              </button>
              <div className="text-sm text-muted">
                Items you select here will be counted every time this campaign loads. If you later edit an OPEX item's value, every campaign using it updates automatically.
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "profit" && (
        <div className="space-y-4">
          {!selectedCampaignId ? (
            <div className="muted">Select a campaign first.</div>
          ) : profitabilityQuery.isLoading ? (
            <div className="loading">Loading...</div>
          ) : profitabilityQuery.error ? (
            <div className="muted">Failed to load profitability.</div>
          ) : (
            <>
              <div className="card">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <Metric label="Campaign Units" value={totals.campaign_qty?.toFixed(0)} />
                  <Metric label="Gross Revenue" value={fromBdt(totals.gross_revenue || 0).toFixed(0)} />
                  <Metric label="Effective Revenue" value={fromBdt(totals.effective_revenue || 0).toFixed(0)} />
                  <Metric label="Variable Profit" value={fromBdt(totals.net_profit_variable || 0).toFixed(0)} />
                  <Metric label="Total OPEX" value={fromBdt(totals.total_opex || 0).toFixed(0)} />
                  <Metric label="Net Profit After OPEX" value={fromBdt(totals.net_profit_after_opex || 0).toFixed(0)} />
                </div>
              </div>

              <div className="card">
                <h3 className="text-xl font-semibold mb-3">Monthly Financial Table</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-border/30 text-muted">
                      <tr>
                        <th className="py-2 px-3 text-left">Month</th>
                        <th className="py-2 px-3 text-left">Qty</th>
                        <th className="py-2 px-3 text-left">Gross Revenue</th>
                        <th className="py-2 px-3 text-left">Effective Revenue</th>
                        <th className="py-2 px-3 text-left">Variable Cost</th>
                        <th className="py-2 px-3 text-left">OPEX</th>
                        <th className="py-2 px-3 text-left">Net Profit After OPEX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((row) => (
                        <tr key={row.month} className="border-b border-border/40">
                          <td className="py-2 px-3">{row.month_nice || row.month}</td>
                          <td className="py-2 px-3">{row.qty}</td>
                          <td className="py-2 px-3">{fromBdt(row.gross_revenue_bdt || 0).toFixed(0)}</td>
                          <td className="py-2 px-3">{fromBdt(row.effective_revenue_bdt || 0).toFixed(0)}</td>
                          <td className="py-2 px-3">{fromBdt(row.variable_cost_bdt || 0).toFixed(0)}</td>
                          <td className="py-2 px-3">{fromBdt(row.opex_cost_bdt || 0).toFixed(0)}</td>
                          <td className="py-2 px-3">{fromBdt(row.net_profit_after_opex_bdt || 0).toFixed(0)}</td>
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

const TabButton = ({ id, active, setActive, label }) => (
  <button
    onClick={() => setActive(id)}
    className={`px-4 py-2 rounded-md border text-sm ${
      active === id ? "border-accent text-accent" : "border-border text-muted hover:text-text"
    }`}
  >
    {label}
  </button>
);

const Input = ({ label, type = "text", value, onChange }) => (
  <div>
    <label className="text-sm text-muted">{label}</label>
    <input
      type={type}
      className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const Metric = ({ label, value }) => (
  <div className="bg-bg border border-border rounded-lg p-3">
    <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default OpexPage;
