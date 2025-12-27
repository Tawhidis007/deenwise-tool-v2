
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCampaigns,
  fetchCampaignInputs,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  saveCampaignQuantities,
  saveProductMonthWeights,
  saveSizeBreakdown,
  saveCampaignOverrides,
  saveCampaignOpex,
  saveCampaignMarketingPlan,
} from "../api/campaigns";
import { fetchProducts } from "../api/products";
import { fetchOpex, createOpex, deleteOpex } from "../api/opex";
import { useCurrency } from "../hooks/useCurrency";

const monthRange = (start, end) => {
  if (!start || !end) return [];
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const from = s <= e ? s : e;
  const to = s <= e ? e : s;
  const months = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  while (y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth() + 1)) {
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
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${y}`;
};

const ProgressRing = ({ total, current }) => {
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  return (
    <div className="relative h-10 w-10">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(var(--color-accent) ${pct}%, var(--color-surface) ${pct}%)` }}
      />
      <div className="absolute inset-1 rounded-full bg-bg flex items-center justify-center text-[10px] text-muted">
        {Math.round(pct)}%
      </div>
    </div>
  );
};
const CampaignsPage = () => {
  const { currency, setCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [campaignForm, setCampaignForm] = React.useState(null);
  const [selectedProducts, setSelectedProducts] = React.useState([]);
  const [quantities, setQuantities] = React.useState({});
  const [perProductWeights, setPerProductWeights] = React.useState({});
  const [sizes, setSizes] = React.useState({});
  const [productOverrides, setProductOverrides] = React.useState({});
  const [statusMsg, setStatusMsg] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [newCamp, setNewCamp] = React.useState({ name: "", start_date: "", end_date: "" });
  const [isEditing, setIsEditing] = React.useState(false);
  const [showProductsModal, setShowProductsModal] = React.useState(false);
  const [showOpexModal, setShowOpexModal] = React.useState(false);
  const [showCreateOpex, setShowCreateOpex] = React.useState(false);
  const [showDeleteOpexModal, setShowDeleteOpexModal] = React.useState(false);
  const [deleteOpexTarget, setDeleteOpexTarget] = React.useState(null);
  const [selectedOpex, setSelectedOpex] = React.useState([]);
  const [attachedOpexDetails, setAttachedOpexDetails] = React.useState([]);
  const [quantitiesDirty, setQuantitiesDirty] = React.useState(false);
  const [collapsedProducts, setCollapsedProducts] = React.useState({});
  const [marketingPlan, setMarketingPlan] = React.useState({});
  const [baseline, setBaseline] = React.useState({
    selected: [],
    quantities: {},
    weights: {},
    sizes: {},
    overrides: {},
    marketing_plan: {},
    opex: [],
  });
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [sizeWarning, setSizeWarning] = React.useState(null);
  const [opexForm, setOpexForm] = React.useState({
    name: "",
    category: "",
    cost_bdt: "",
    start_month: "",
    end_month: "",
    is_one_time: false,
    notes: "",
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });
  const { data: opexList = [] } = useQuery({
    queryKey: ["opex"],
    queryFn: () => fetchOpex({ active: false }),
    staleTime: 60 * 1000,
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
    staleTime: 60 * 1000,
  });

  React.useEffect(() => {
    if (!selectedCampaign && campaigns.length) setSelectedCampaign(campaigns[0]);
  }, [campaigns, selectedCampaign]);

  const { data: inputs } = useQuery({
    queryKey: ["campaignInputs", selectedCampaign?.id],
    queryFn: () => fetchCampaignInputs(selectedCampaign.id),
    enabled: !!selectedCampaign,
  });

  React.useEffect(() => {
    if (!inputs) return;
    const initialSelected =
      inputs.quantities && Object.keys(inputs.quantities).length > 0
        ? Object.keys(inputs.quantities)
        : products.map((p) => p.id);
    setSelectedProducts(initialSelected);
    setQuantities(inputs.quantities || {});
    setPerProductWeights(inputs.product_month_weights || {});
    setSizes(inputs.size_breakdown || {});
    setProductOverrides(inputs.product_overrides || {});
    setMarketingPlan(inputs.marketing_plan || {});
    setSelectedOpex(inputs.campaign?.opex_ids || []);
    setAttachedOpexDetails(inputs.campaign?.attached_opex || []);
    setCampaignForm(inputs.campaign);
    setIsEditing(false);
    setQuantitiesDirty(false);
    setBaseline({
      selected: initialSelected,
      quantities: inputs.quantities || {},
      weights: inputs.product_month_weights || {},
      sizes: inputs.size_breakdown || {},
      overrides: inputs.product_overrides || {},
      marketing_plan: inputs.marketing_plan || {},
      opex: inputs.campaign?.opex_ids || [],
    });
  }, [inputs, products]);
  const createCampMut = useMutation({
    mutationFn: createCampaign,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setSelectedCampaign(data);
      setShowCreate(false);
      setStatusMsg("Campaign created.");
    },
  });

  const updateCampMut = useMutation({
    mutationFn: updateCampaign,
    onSuccess: (data) => {
      setSelectedCampaign(data);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaignInputs", data.id] });
      setStatusMsg("Campaign updated.");
      setIsEditing(false);
    },
  });

  const deleteCampMut = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ["campaignInputs", id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setSelectedCampaign(null);
      setCampaignForm(null);
      setSelectedProducts([]);
      setQuantities({});
      setPerProductWeights({});
      setSizes({});
      setProductOverrides({});
      setSelectedOpex([]);
      setAttachedOpexDetails([]);
      setShowDeleteModal(false);
      setQuantitiesDirty(false);
      setStatusMsg("Campaign deleted.");
    },
  });

  const saveQuantMut = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) return;
      const id = selectedCampaign.id;
      const filteredQuantities = selectedProducts.reduce((acc, pid) => {
        const num = Number(quantities[pid] || 0);
        if (!Number.isNaN(num) && num > 0) acc[pid] = num;
        return acc;
      }, {});
      const filteredWeights = selectedProducts.reduce((acc, pid) => {
        if (perProductWeights[pid]) acc[pid] = perProductWeights[pid];
        return acc;
      }, {});
      const filteredSizes = selectedProducts.reduce((acc, pid) => {
        if (sizes[pid]) acc[pid] = sizes[pid];
        return acc;
      }, {});
      const filteredOverrides = selectedProducts.reduce((acc, pid) => {
        if (productOverrides[pid]) acc[pid] = productOverrides[pid];
        return acc;
      }, {});
      const filteredMarketingPlan = selectedProducts.reduce((acc, pid) => {
        if (marketingPlan[pid]) acc[pid] = marketingPlan[pid];
        return acc;
      }, {});

      await saveCampaignQuantities({ id, quantities: filteredQuantities });
      await saveProductMonthWeights({ id, weights: filteredWeights });
      await saveSizeBreakdown({ id, sizes: filteredSizes });
      await saveCampaignOverrides({ id, overrides: filteredOverrides });
      await saveCampaignMarketingPlan({ id, marketing_plan: filteredMarketingPlan });
      await saveCampaignOpex({ campaignId: id, opexIds: selectedOpex });
    },
    onSuccess: () => {
      setStatusMsg("Saved.");
      setQuantitiesDirty(false);
      setBaseline({
        selected: [...selectedProducts],
        quantities: { ...quantities },
        weights: { ...perProductWeights },
        sizes: { ...sizes },
        overrides: { ...productOverrides },
        marketing_plan: { ...marketingPlan },
        opex: [...selectedOpex],
      });
    },
  });

  const createOpexMut = useMutation({
    mutationFn: createOpex,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opex"] });
      setSelectedOpex((prev) => Array.from(new Set([...prev, data.id])));
      setOpexForm({
        name: "",
        category: "",
        cost_bdt: "",
        start_month: "",
        end_month: "",
        is_one_time: false,
        notes: "",
      });
      setShowCreateOpex(false);
      setStatusMsg("OPEX created.");
    },
  });

  const deleteOpexMut = useMutation({
    mutationFn: deleteOpex,
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["opex"] });
      setSelectedOpex((prev) => prev.filter((oid) => oid !== id));
      setAttachedOpexDetails((prev) => prev.filter((item) => item.id !== id));
      setShowDeleteOpexModal(false);
      setDeleteOpexTarget(null);
      setStatusMsg("OPEX deleted.");
    },
    onError: () => setStatusMsg("Failed to delete OPEX."),
  });

  const months = selectedCampaign ? monthRange(campaignForm?.start_date, campaignForm?.end_date) : [];
  const toggleProduct = (pid) => {
    setSelectedProducts((prev) => {
      const exists = prev.includes(pid);
      if (exists) {
        const next = prev.filter((p) => p !== pid);
        const q = { ...quantities };
        delete q[pid];
        setQuantities(q);
        const w = { ...perProductWeights };
        delete w[pid];
        setPerProductWeights(w);
        const s = { ...sizes };
        delete s[pid];
        setSizes(s);
        const mp = { ...marketingPlan };
        delete mp[pid];
        setMarketingPlan(mp);
        setQuantitiesDirty(true);
        return next;
      }
      setQuantitiesDirty(true);
      return [...prev, pid];
    });
  };

  const setQty = (pid, val) => {
    const num = Number(val || 0);
    setQuantities((prev) => ({ ...prev, [pid]: num }));
    setQuantitiesDirty(true);
  };

  const setWeight = (pid, month, val) => {
    const num = Number(val || 0);
    if (Number.isNaN(num) || num < 0) return;
    const totalQty = Number(quantities[pid] || 0);
    setPerProductWeights((prev) => {
      const current = { ...(prev[pid] || {}) };
      current[month] = num;
      if (months.length > 1) {
        const last = months[months.length - 1];
        const sumExceptLast = months
          .filter((m) => m !== last)
          .reduce((acc, m) => acc + Number(current[m] || 0), 0);
        current[last] = Math.max(0, totalQty - sumExceptLast);
      } else if (months.length === 1) {
        current[months[0]] = totalQty;
      }
      return { ...prev, [pid]: current };
    });
    setQuantitiesDirty(true);
  };

  const setSize = (pid, size, val) => {
    const num = Number(val || 0);
    const current = sizes[pid] || {};
    const newTotal = Object.entries(current).reduce(
      (acc, [k, v]) => (k === size ? acc : acc + Number(v || 0)),
      0
    ) + num;
    const max = Number(quantities[pid] || 0);
    if (max > 0 && newTotal > max) {
      setSizeWarning({ productName: products.find((p) => p.id === pid)?.name, total: max });
      return;
    }
    setSizes((prev) => ({ ...prev, [pid]: { ...(prev[pid] || {}), [size]: num } }));
    setQuantitiesDirty(true);
  };

  const setOverride = (pid, field, val, { asPercent = false } = {}) => {
    const num = val === "" || val === null ? null : Number(val);
    if (num !== null && Number.isNaN(num)) return;
    const storeVal = asPercent && num !== null ? num / 100 : num;
    setProductOverrides((prev) => ({ ...prev, [pid]: { ...(prev[pid] || {}), [field]: storeVal } }));
    setQuantitiesDirty(true);
  };

  const setMarketingAmount = (pid, month, val) => {
    const num = Number(val || 0);
    if (Number.isNaN(num) || num < 0) return;
    setMarketingPlan((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] || {}),
        [month]: num,
      },
    }));
    setQuantitiesDirty(true);
  };

  const resetToBaseline = () => {
    setSelectedProducts(baseline.selected || []);
    setQuantities(baseline.quantities || {});
    setPerProductWeights(baseline.weights || {});
    setSizes(baseline.sizes || {});
    setProductOverrides(baseline.overrides || {});
    setMarketingPlan(baseline.marketing_plan || {});
    setSelectedOpex(baseline.opex || []);
    setQuantitiesDirty(false);
  };

  const startEdit = () => {
    setIsEditing(true);
    setBaseline({
      selected: [...selectedProducts],
      quantities: { ...quantities },
      weights: { ...perProductWeights },
      sizes: { ...sizes },
      overrides: { ...productOverrides },
      marketing_plan: { ...marketingPlan },
      opex: [...selectedOpex],
    });
  };

  const cancelEdit = () => {
    resetToBaseline();
    setIsEditing(false);
  };

  const changeCampaign = (id) => {
    const camp = campaigns.find((c) => c.id === id);
    setSelectedCampaign(camp || null);
  };

  const createCampaignHandler = () => {
    if (!newCamp.name) {
      setStatusMsg("Name required.");
      return;
    }
    createCampMut.mutate({ ...newCamp, distribution_mode: "Custom", currency });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteCampMut.mutate(deleteTarget);
  };

  const disabled = !isEditing;
  const selectedProductObjects = selectedProducts.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  return (
    <>
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent">CAMPAIGN PLANNING</p>
            <h1 className="text-3xl font-semibold">Campaign Financial Scenarios</h1>
            <p className="text-muted text-sm">
              Model campaign performance by product mix, cost structure, and margin impact.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Display currency</label>
            <select
              className="bg-surface border border-border/70 rounded px-3 py-2 text-sm"
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

        <section className="card space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="text-sm text-muted">Selected campaign</div>
              <div className="flex flex-wrap gap-3 items-center">
                <select
                  className="bg-surface border border-border/70 rounded px-3 py-2"
                  value={selectedCampaign?.id || ""}
                  onChange={(e) => changeCampaign(e.target.value)}
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap justify-start md:justify-end gap-2">
              {!isEditing && (
                <button
                  className="px-4 py-2 rounded-md font-semibold bg-accent text-bg"
                  onClick={() => setShowCreate(true)}
                  disabled={isEditing}
                >
                  Create Campaign
                </button>
              )}
              <button
                className={`border border-border/60 px-4 py-2 rounded-md ${isEditing ? "text-text" : "text-muted"}`}
                onClick={isEditing ? cancelEdit : startEdit}
                disabled={!selectedCampaign}
              >
                {isEditing ? "Cancel" : "Edit Campaign"}
              </button>
              <button
                className="border px-4 py-2 rounded-md disabled:opacity-50"
                style={{ borderColor: "var(--color-returns)", color: "var(--color-returns)" }}
                onClick={() => {
                  setDeleteTarget(selectedCampaign?.id || null);
                  setShowDeleteModal(true);
                }}
                disabled={!selectedCampaign || isEditing || deleteCampMut.isLoading}
              >
                Delete Campaign
              </button>
            </div>
          </div>

          {campaignForm && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted">Name</label>
                <input
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={campaignForm.name || ""}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-sm text-muted">Start</label>
                <input
                  type="date"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={campaignForm.start_date?.slice(0, 10) || ""}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, start_date: e.target.value }))}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-sm text-muted">End</label>
                <input
                  type="date"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={campaignForm.end_date?.slice(0, 10) || ""}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, end_date: e.target.value }))}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </section>
        {!products.length ? (
          <div className="muted">No products found. Add products first.</div>
        ) : !selectedCampaign ? (
          <div className="muted">Create or select a campaign to begin.</div>
        ) : (
          <div className="space-y-6">
            <div className="card space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Campaign Products & Quantities</h2>
                  <p className="text-sm text-muted">Products assigned to this campaign and their total quantities.</p>
                </div>
                {isEditing && (
                  <button
                    className="bg-accent text-bg px-3 py-2 rounded-md font-semibold"
                    onClick={() => setShowProductsModal(true)}
                  >
                    Manage Campaign Products
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedProductObjects.map((p) => (
                  <span key={p.id} className="px-3 py-1 rounded-full bg-border/40 text-sm">
                    {p.name}
                  </span>
                ))}
                {selectedProductObjects.length === 0 && <span className="text-muted text-sm">No products selected.</span>}
              </div>

              {selectedProducts.length === 0 ? (
                <div className="muted">Select at least one product.</div>
              ) : (
                <div className="space-y-4">
                  {selectedProducts.map((pid) => {
                    const prod = products.find((p) => p.id === pid);
                    if (!prod) return null;
                    const collapsed = collapsedProducts[pid];
                    const totalQty = Number(quantities[pid] || 0);
                    const sizeTotal = Object.values(sizes[pid] || {}).reduce((a, b) => a + Number(b || 0), 0);
                    return (
                      <div key={pid} className="card-standout border border-border/60 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{prod.name}</div>
                            <div className="text-xs text-muted">{prod.category}</div>
                          </div>
                          <button
                            className="px-3 py-1 rounded-md border border-border/60 text-sm text-muted hover:text-text"
                            onClick={() => setCollapsedProducts((prev) => ({ ...prev, [pid]: !collapsed }))}
                          >
                            {collapsed ? "Expand" : "Collapse"}
                          </button>
                        </div>

                        {collapsed ? null : (
                          <>
                            <div className="flex items-center justify-between mb-3 gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-text">Total Qty</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="bg-surface border border-border/70 rounded px-3 py-2 w-32"
                                  value={totalQty}
                                  onChange={(e) => setQty(pid, e.target.value)}
                                  disabled={disabled}
                                />
                              </div>
                              <ProgressRing total={totalQty} current={sizeTotal} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                              <div>
                                <label className="text-xs text-muted">Packaging cost ({currency})</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="mt-1 w-full bg-surface border border-border/70 rounded px-2 py-1 text-sm"
                                  value={productOverrides[pid]?.packaging_cost_bdt ?? ""}
                                  onChange={(e) => setOverride(pid, "packaging_cost_bdt", e.target.value)}
                                  disabled={disabled}
                                  placeholder="override"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted">Discount / promo (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="mt-1 w-full bg-surface border border-border/70 rounded px-2 py-1 text-sm"
                                  value={
                                    productOverrides[pid]?.discount_rate !== undefined &&
                                    productOverrides[pid]?.discount_rate !== null
                                      ? Number(productOverrides[pid].discount_rate) * 100
                                      : ""
                                  }
                                  onChange={(e) => setOverride(pid, "discount_rate", e.target.value, { asPercent: true })}
                                  disabled={disabled}
                                  placeholder="override %"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted">Return rate (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="mt-1 w-full bg-surface border border-border/70 rounded px-2 py-1 text-sm"
                                  value={
                                    productOverrides[pid]?.return_rate !== undefined &&
                                    productOverrides[pid]?.return_rate !== null
                                      ? Number(productOverrides[pid].return_rate) * 100
                                      : ""
                                  }
                                  onChange={(e) => setOverride(pid, "return_rate", e.target.value, { asPercent: true })}
                                  disabled={disabled}
                                  placeholder="override %"
                                />
                              </div>
                            </div>
                            {campaignForm?.distribution_mode === "Custom" && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {months.map((m, idx) => (
                                  <div key={m}>
                                    <label className="text-xs text-muted">Target Qty Sell ({niceMonth(m).split(" ")[0]})</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      className="mt-1 w-full bg-surface border border-border/70 rounded px-2 py-1 text-sm"
                                      value={perProductWeights[pid]?.[m] ?? (months.length === 1 ? totalQty : 0)}
                                      onChange={(e) => setWeight(pid, m, e.target.value)}
                                      disabled={disabled}
                                    />
                                    {idx === months.length - 1 && months.length > 1 && (
                                      <p className="text-[11px] text-muted mt-1">Auto-balances to reach total qty</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3">
                              <div className="text-xs text-muted mb-2">Size breakdown (must sum to total qty)</div>
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                                  <div key={s}>
                                    <label className="text-xs text-muted">{s}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      className="mt-1 w-full bg-surface border border-border/70 rounded px-2 py-1 text-sm"
                                      value={sizes[pid]?.[s] || 0}
                                      onChange={(e) => setSize(pid, s, e.target.value)}
                                      disabled={disabled}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isEditing && quantitiesDirty && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setQuantitiesDirty(false);
                      saveQuantMut.mutate();
                    }}
                    className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
                    disabled={saveQuantMut.isLoading}
                  >
                    Save Quantities
                  </button>
                  <button
                    onClick={() => {
                      resetToBaseline();
                      setIsEditing(true);
                    }}
                    className="px-4 py-2 rounded-md border border-border/60 text-muted"
                    disabled={saveQuantMut.isLoading}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="card space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Marketing Plan</h2>
                  <p className="text-sm text-muted">
                    Set per-product marketing spend by month for this campaign.
                  </p>
                </div>
              </div>
              {!selectedCampaign || months.length === 0 ? (
                <div className="text-sm text-muted">Select a campaign to plan monthly marketing.</div>
              ) : selectedProducts.length === 0 ? (
                <div className="text-sm text-muted">Select products to plan marketing spend.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-muted border-b border-border/60">
                      <tr>
                        <th className="py-2 pr-3">Product</th>
                        {months.map((m) => (
                          <th key={m} className="py-2 pr-3">
                            {niceMonth(m)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {selectedProducts.map((pid) => {
                        const prod = products.find((p) => p.id === pid);
                        if (!prod) return null;
                        return (
                          <tr key={pid}>
                            <td className="py-2 pr-3">{prod.name}</td>
                            {months.map((m) => (
                              <td key={m} className="py-2 pr-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="w-full bg-surface border border-border/70 rounded px-2 py-1 text-sm"
                                  value={marketingPlan[pid]?.[m] ?? 0}
                                  onChange={(e) => setMarketingAmount(pid, m, e.target.value)}
                                  disabled={disabled}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* OPEX */}
            <div className="card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">OPEX for Campaign</h2>
                {isEditing && (
                  <button
                    className="bg-accent text-bg px-3 py-2 rounded-md font-semibold"
                    onClick={() => setShowOpexModal(true)}
                  >
                    Manage OPEX
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedOpex.length === 0 ? (
                  <span className="text-muted text-sm">No OPEX items linked.</span>
                ) : (
                  selectedOpex.map((id) => {
                    const item = opexList.find((o) => o.id === id) || attachedOpexDetails.find((o) => o.id === id);
                    return (
                      <div
                        key={id}
                        className="px-3 py-2 rounded-lg bg-border/30 text-sm border border-border/60 flex flex-col gap-1"
                      >
                        <div className="font-semibold">{item?.name || "Unknown OPEX"}</div>
                        <div className="text-xs text-muted">
                          {item?.category || "N/A"} - {item?.cost_bdt ? `${item.cost_bdt} ${currency}` : "Cost N/A"}
                        </div>
                          <div className="text-xs text-muted">
                            {item?.start_month || "n/a"} {" - "} {item?.end_month || "ongoing"}
                          </div>
                        {!item && <span className="text-xs text-muted">missing id: {id}</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3">
                <button
                  className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
                  onClick={async () => {
                    if (!selectedCampaign) return;
                    await saveQuantMut.mutateAsync();
                    await updateCampMut.mutateAsync({
                      id: selectedCampaign.id,
                      payload: {
                        name: campaignForm.name,
                        start_date: campaignForm.start_date,
                        end_date: campaignForm.end_date,
                        distribution_mode: "Custom",
                      },
                    });
                  }}
                  disabled={updateCampMut.isLoading || saveQuantMut.isLoading}
                >
                  Save Campaign
                </button>
                <button
                  className="px-4 py-2 rounded-md border border-border/60 text-muted"
                  onClick={cancelEdit}
                  disabled={updateCampMut.isLoading || saveQuantMut.isLoading}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Modals */}
      {showProductsModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Manage Campaign Products</h3>
              <button className="text-muted" onClick={() => setShowProductsModal(false)}>
                ?
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
              {products.map((p) => {
                const checked = selectedProducts.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`border border-border/70 rounded-md p-3 flex items-center gap-3 cursor-pointer ${
                      checked ? "bg-border/20" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4"
                    />
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted">{p.category}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border border-border/60 text-muted" onClick={() => setShowProductsModal(false)}>
                Close
              </button>
              <button
                className="px-4 py-2 rounded-md bg-accent text-bg font-semibold"
                onClick={() => {
                  setQuantitiesDirty(true);
                  setShowProductsModal(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpexModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-5xl p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Attach OPEX to campaign</h3>
                <p className="text-sm text-muted">Select existing OPEX or create a new one, then save the campaign to persist.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="bg-accent text-bg px-3 py-2 rounded-md font-semibold"
                  onClick={() => setShowCreateOpex(true)}
                >
                  Create OPEX
                </button>
                <button className="text-muted" onClick={() => setShowOpexModal(false)}>
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-border/70 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Available OPEX</h4>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {opexList.length === 0 && <div className="text-sm text-muted">No OPEX items yet.</div>}
                  {opexList.map((o) => {
                    const checked = selectedOpex.includes(o.id);
                    return (
                      <div
                        key={o.id}
                        className={`border border-border/70 rounded-md p-3 flex items-start justify-between gap-3 ${
                          checked ? "bg-border/20" : ""
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{o.name}</div>
                          <div className="text-xs text-muted">
                            {o.category} {" - "} {o.cost_bdt} {currency}
                          </div>
                          <div className="text-xs text-muted">
                            {o.start_month || "n/a"} {" - "} {o.end_month || "ongoing"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {checked ? (
                            <span className="px-3 py-1 rounded-md border border-border/70 text-xs text-muted">
                              Attached
                            </span>
                          ) : (
                            <button
                              className="px-3 py-1 rounded-md border border-border/60 text-sm text-muted hover:text-text"
                              onClick={() => setSelectedOpex((prev) => [...prev, o.id])}
                            >
                              Attach
                            </button>
                          )}
                          <button
                            className="px-3 py-1 rounded-md border text-xs"
                            style={{ borderColor: "var(--color-returns)", color: "var(--color-returns)" }}
                            onClick={() => {
                              setDeleteOpexTarget(o);
                              setShowDeleteOpexModal(true);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-border/70 rounded-lg p-3 space-y-3">
                <h4 className="font-semibold">Attached to this campaign</h4>
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {selectedOpex.length === 0 && <div className="text-sm text-muted">No OPEX linked.</div>}
                  {selectedOpex.map((id) => {
                    const item = opexList.find((o) => o.id === id) || attachedOpexDetails.find((o) => o.id === id);
                    return (
                      <div key={id} className="border border-border/70 rounded-md p-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{item?.name || "Unknown OPEX"}</div>
                          <div className="text-xs text-muted">
                            {item?.category || "N/A"} - {item?.cost_bdt ? `${item.cost_bdt} ${currency}` : "Cost N/A"}
                          </div>
                          <div className="text-xs text-muted">
                            {item?.start_month || "n/a"} {" - "} {item?.end_month || "ongoing"}
                          </div>
                          {!item && <div className="text-xs text-muted">missing id: {id}</div>}
                        </div>
                        <button
                          className="px-3 py-1 rounded-md border border-border/60 text-sm text-muted hover:text-text"
                          onClick={() => setSelectedOpex((prev) => prev.filter((oid) => oid !== id))}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border border-border/60 text-muted" onClick={() => setShowOpexModal(false)}>
                Close
              </button>
              <button
                className="px-4 py-2 rounded-md bg-accent text-bg font-semibold"
                onClick={() => setShowOpexModal(false)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteOpexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Delete OPEX item?</h3>
              <button className="text-muted" onClick={() => setShowDeleteOpexModal(false)}>
                ?
              </button>
            </div>
            <p className="text-sm text-muted">
              {deleteOpexTarget?.name || "This OPEX item"} will be removed from the library and detached from the
              current campaign.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-md border border-border/60 text-muted"
                onClick={() => setShowDeleteOpexModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-md font-semibold"
                style={{ backgroundColor: "var(--color-returns)", color: "var(--color-text)" }}
                onClick={() => {
                  if (deleteOpexTarget?.id) {
                    deleteOpexMut.mutate(deleteOpexTarget.id);
                  }
                }}
                disabled={deleteOpexMut.isLoading}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateOpex && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create OPEX</h3>
              <button className="text-muted" onClick={() => setShowCreateOpex(false)}>
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted">Name</label>
                <input
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={opexForm.name}
                  onChange={(e) => setOpexForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Category</label>
                <input
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={opexForm.category}
                  onChange={(e) => setOpexForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Cost ({currency})</label>
                <input
                  type="number"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={opexForm.cost_bdt}
                  onChange={(e) => setOpexForm((p) => ({ ...p, cost_bdt: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Start month</label>
                <input
                  type="month"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={opexForm.start_month}
                  onChange={(e) => setOpexForm((p) => ({ ...p, start_month: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted">End month</label>
                <input
                  type="month"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={opexForm.end_month}
                  onChange={(e) => setOpexForm((p) => ({ ...p, end_month: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={opexForm.is_one_time}
                  onChange={(e) => setOpexForm((p) => ({ ...p, is_one_time: e.target.checked }))}
                />
                One-time expense
              </label>
              <div className="md:col-span-2">
                <label className="text-xs text-muted">Notes</label>
                <textarea
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  rows={2}
                  value={opexForm.notes}
                  onChange={(e) => setOpexForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border border-border/60 text-muted" onClick={() => setShowCreateOpex(false)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-md bg-accent text-bg font-semibold"
                onClick={() => createOpexMut.mutate(opexForm)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Campaign</h3>
              <button className="text-muted" onClick={() => setShowCreate(false)}>
                ?
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-muted">Name</label>
                <input
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={newCamp.name}
                  onChange={(e) => setNewCamp((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Start</label>
                <input
                  type="date"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={newCamp.start_date}
                  onChange={(e) => setNewCamp((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted">End</label>
                <input
                  type="date"
                  className="mt-1 w-full bg-surface border border-border/70 rounded px-3 py-2"
                  value={newCamp.end_date}
                  onChange={(e) => setNewCamp((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border border-border/60 text-muted" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded-md bg-accent text-bg font-semibold" onClick={createCampaignHandler}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Delete campaign?</h3>
              <button className="text-muted" onClick={() => setShowDeleteModal(false)}>
                ?
              </button>
            </div>
            <p className="text-sm text-muted">
              This will remove the campaign and its linked inputs. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border border-border/60 text-muted" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-md bg-red-500 text-text font-semibold"
                onClick={confirmDelete}
                disabled={deleteCampMut.isLoading}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {sizeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Size breakdown limit</h3>
              <button className="text-muted" onClick={() => setSizeWarning(null)}>
                ?
              </button>
            </div>
            <p className="text-sm text-muted">
              {sizeWarning.productName || "Product"} has a total quantity of {sizeWarning.total}. Size allocations cannot exceed this.
            </p>
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded-md bg-accent text-bg font-semibold" onClick={() => setSizeWarning(null)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CampaignsPage;



