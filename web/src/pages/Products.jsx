import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProducts, createProduct, updateProduct, deleteProduct } from "../api/products";
import { useCurrency } from "../hooks/useCurrency";
import clsx from "clsx";

const numberField = (val, fallback = 0) => {
  const num = Number(val);
  return Number.isNaN(num) ? fallback : num;
};

const emptyProductForm = {
  product_code: "",
  name: "",
  category: "",
  notes: "",
  price: 0,
  manufacturing_cost: 0,
  packaging_cost: 0,
  shipping_cost: 0,
  marketing_cost: 0,
  return_rate: 0,
  discount_rate: 0,
  vat_included: false,
};

const ProductRow = ({ product, symbol, onSelect, isSelected }) => (
  <tr
    className={clsx(
      "border-b border-border/40 hover:bg-border/30 transition-colors cursor-pointer",
      isSelected && "bg-border/40"
    )}
    onClick={() => onSelect(product.id)}
  >
    <td className="py-3 px-3 font-semibold">{product.name}</td>
    <td className="py-3 px-3 text-muted">{product.category}</td>
    <td className="py-3 px-3 text-muted">{product.product_code}</td>
    <td className="py-3 px-3">
      {symbol}
      {product.display.price.toFixed(2)}
    </td>
    <td className="py-3 px-3 text-muted">
      {symbol}
      {product.display.manufacturing.toFixed(2)}
    </td>
    <td className="py-3 px-3 text-muted">
      {symbol}
      {product.display.unit_gross_profit.toFixed(2)}
    </td>
    <td className="py-3 px-3 text-muted">{product.display.gross_margin_pct.toFixed(1)}%</td>
  </tr>
);

const ProductsPage = () => {
  const queryClient = useQueryClient();
  const { currency, setCurrency, toBdt, fromBdt, symbol } = useCurrency();
  const [form, setForm] = React.useState(emptyProductForm);
  const [editId, setEditId] = React.useState(null);
  const [editRow, setEditRow] = React.useState(emptyProductForm);
  const [statusMsg, setStatusMsg] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const {
    data: products = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const createMut = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setStatusMsg("Product added.");
      setForm(emptyProductForm);
      setEditId(null);
      setShowAdd(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setStatusMsg("Product updated.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditId(null);
      setForm(emptyProductForm);
      setStatusMsg("Product deleted.");
      setConfirmDelete(null);
    },
  });

  const handleInput = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (payload) => {
    const errors = [];
    ["name", "category", "price_bdt", "manufacturing_cost_bdt"].forEach((f) => {
      if (payload[f] === undefined || payload[f] === null || payload[f] === "") {
        errors.push(`Missing required field: ${f}`);
      }
    });
    ["price_bdt", "manufacturing_cost_bdt"].forEach((f) => {
      const num = Number(payload[f] || 0);
      if (Number.isNaN(num)) errors.push(`${f} must be a number`);
      if (num < 0) errors.push(`${f} cannot be negative`);
    });
    return errors;
  };

  const buildPayload = (base) => ({
    product_code: base.product_code || undefined,
    name: base.name,
    category: base.category,
    price_bdt: toBdt(numberField(base.price)),
    manufacturing_cost_bdt: toBdt(numberField(base.manufacturing_cost)),
    packaging_cost_bdt: toBdt(numberField(base.packaging_cost)),
    shipping_cost_bdt: toBdt(numberField(base.shipping_cost)),
    marketing_cost_bdt: toBdt(numberField(base.marketing_cost)),
    return_rate: Number(base.return_rate || 0),
    discount_rate: Number(base.discount_rate || 0),
    vat_included: Boolean(base.vat_included),
    notes: base.notes || "",
    is_active: true,
  });

  const submitAdd = () => {
    const payload = buildPayload({
      ...form,
      packaging_cost: 0,
      shipping_cost: 0,
      marketing_cost: 0,
      return_rate: 0,
      discount_rate: 0,
      vat_included: false,
    });
    const errors = validate(payload);
    if (errors.length) {
      setStatusMsg(errors.join("; "));
      return;
    }
    createMut.mutate(payload);
    setShowAdd(false);
  };

  const submitUpdate = () => {
    if (!editId) return;
    const existing = products.find((p) => p.id === editId);
    const payload = buildPayload({
      ...editRow,
      packaging_cost: existing ? fromBdt(existing.packaging_cost_bdt || 0) : 0,
      shipping_cost: existing ? fromBdt(existing.shipping_cost_bdt || 0) : 0,
      marketing_cost: existing ? fromBdt(existing.marketing_cost_bdt || 0) : 0,
      return_rate: existing ? existing.return_rate || 0 : 0,
      discount_rate: existing ? existing.discount_rate || 0 : 0,
      vat_included: existing ? existing.vat_included : false,
    });
    const errors = validate(payload);
    if (errors.length) {
      setStatusMsg(errors.join("; "));
      return;
    }
    updateMut.mutate({ id: editId, payload });
  };

  const selectProduct = (id) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    setEditId(id);
    setEditRow({
      product_code: prod.product_code || "",
      name: prod.name || "",
      category: prod.category || "",
      notes: prod.notes || "",
      price: fromBdt(prod.price_bdt || 0),
      manufacturing_cost: fromBdt(prod.manufacturing_cost_bdt || 0),
      packaging_cost: fromBdt(prod.packaging_cost_bdt || 0),
      shipping_cost: fromBdt(prod.shipping_cost_bdt || 0),
      marketing_cost: fromBdt(prod.marketing_cost_bdt || 0),
      return_rate: prod.return_rate || 0,
      discount_rate: prod.discount_rate || 0,
      vat_included: Boolean(prod.vat_included),
    });
    setShowAdd(false);
  };

  const startAddNew = () => {
    setEditId(null);
    setEditRow(emptyProductForm);
    setForm(emptyProductForm);
    setStatusMsg("");
    setShowAdd(true);
  };

  const computed = products.map((p) => {
    const price = fromBdt(p.price_bdt || 0);
    const manufacturing = fromBdt(p.manufacturing_cost_bdt || 0);
    const grossProfit = price - manufacturing;
    const grossMarginPct = price === 0 ? 0 : (grossProfit / price) * 100;
    const display = {
      price,
      manufacturing,
      unit_gross_profit: grossProfit,
      gross_margin_pct: grossMarginPct,
    };
    return { ...p, display };
  });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();
  const filteredProducts = computed.filter((p) =>
    filterCategory ? p.category === filterCategory : true
  );
  const isEmpty = !isLoading && filteredProducts.length === 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">PRODUCT MASTER DATA</p>
          <h1 className="text-3xl font-semibold">Product Cost & Pricing Model</h1>
          <p className="text-muted text-sm">
            Maintain canonical product definitions that power campaign and revenue forecasting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Currency</label>
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

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Current Product Catalogue</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">Category</label>
              <select
                className="bg-bg border border-border rounded px-3 py-2 text-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                startAddNew();
                setShowAdd(true);
              }}
              className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
            >
              Add New Product
            </button>
          </div>
        </div>

        {statusMsg && <div className="text-sm text-accent">{statusMsg}</div>}

        {isLoading ? (
          <div className="loading">Loading products...</div>
        ) : isError ? (
          <div className="text-sm text-red-400">
            Unable to load products: {error?.message || "Unknown error"}
          </div>
        ) : isEmpty ? (
          <div className="muted">No products yet. Add your first one.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-border/30 text-muted">
                <tr>
                  <th className="py-3 px-3 text-left">Name</th>
                  <th className="py-3 px-3 text-left">Category</th>
                  <th className="py-3 px-3 text-left">Code</th>
                  <th className="py-3 px-3 text-left">Price ({symbol})</th>
                  <th className="py-3 px-3 text-left">Manufacturing Cost ({symbol})</th>
                  <th className="py-3 px-3 text-left">Gross Profit ({symbol})</th>
                  <th className="py-3 px-3 text-left">Gross Margin</th>
                  <th className="py-3 px-3 text-left w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) =>
                  editId === p.id ? (
                    <tr key={p.id} className="border-b border-border/40 bg-border/30">
                      <td className="py-2 px-3">
                        <input
                          className="w-full bg-bg border border-border rounded px-2 py-1"
                          value={editRow.name}
                          onChange={(e) => setEditRow((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="w-full bg-bg border border-border rounded px-2 py-1"
                          value={editRow.category}
                          onChange={(e) =>
                            setEditRow((prev) => ({ ...prev, category: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="w-full bg-bg border border-border rounded px-2 py-1"
                          value={editRow.product_code}
                          onChange={(e) =>
                            setEditRow((prev) => ({ ...prev, product_code: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-bg border border-border rounded px-2 py-1"
                          value={editRow.price}
                          onChange={(e) =>
                            setEditRow((prev) => ({ ...prev, price: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-bg border border-border rounded px-2 py-1"
                          value={editRow.manufacturing_cost}
                          onChange={(e) =>
                            setEditRow((prev) => ({
                              ...prev,
                              manufacturing_cost: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 px-3 text-muted">
                        {symbol}
                        {(numberField(editRow.price) - numberField(editRow.manufacturing_cost)).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-muted">
                        {(() => {
                          const price = numberField(editRow.price);
                          const margin = price === 0 ? 0 : ((price - numberField(editRow.manufacturing_cost)) / price) * 100;
                          return `${margin.toFixed(1)}%`;
                        })()}
                      </td>
                      <td className="py-2 px-3 space-x-2">
                        <button
                          className="text-sm bg-accent text-bg px-3 py-1 rounded-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            submitUpdate();
                          }}
                          disabled={updateMut.isLoading}
                        >
                          Save
                        </button>
                        <button
                          className="text-sm border border-border px-3 py-1 rounded-md text-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditId(null);
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={p.id}
                      className="border-b border-border/40 hover:bg-border/30 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold">{p.name}</td>
                      <td className="py-3 px-3 text-muted">{p.category}</td>
                      <td className="py-3 px-3 text-muted">{p.product_code}</td>
                      <td className="py-3 px-3">
                        {symbol}
                        {p.display.price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {symbol}
                        {p.display.manufacturing.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {symbol}
                        {p.display.unit_gross_profit.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {p.display.gross_margin_pct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 space-x-2">
                        <button
                          className="text-sm border border-border px-3 py-1 rounded-md text-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectProduct(p.id);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm text-red-400 px-3 py-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete({ id: p.id, name: p.name });
                          }}
                          disabled={deleteMut.isLoading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-4xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-accent">Add product</p>
                <h2 className="text-xl font-semibold">Add a New Product</h2>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="h-10 w-10 rounded-full border border-border text-muted hover:text-text"
                aria-label="Close add dialog"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted">Product Code (optional)</label>
                  <input
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={form.product_code}
                    onChange={(e) => handleInput("product_code", e.target.value)}
                    placeholder="e.g., TSHIRT-001"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted">Product Name*</label>
                  <input
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={form.name}
                    onChange={(e) => handleInput("name", e.target.value)}
                    placeholder="e.g., Premium T-Shirt"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted">Category*</label>
                  <input
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={form.category}
                    onChange={(e) => handleInput("category", e.target.value)}
                    placeholder="e.g., Tops"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted">Notes</label>
                  <textarea
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => handleInput("notes", e.target.value)}
                    placeholder="Anything helpful for the team"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted">Selling Price ({symbol})*</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={form.price}
                    onChange={(e) => handleInput("price", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted">Manufacturing Cost ({symbol})*</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
                    value={form.manufacturing_cost}
                    onChange={(e) => handleInput("manufacturing_cost", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 justify-end">
              <button
                onClick={() => setShowAdd(false)}
                className="bg-border text-text px-4 py-2 rounded-md font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={submitAdd}
                className="bg-accent text-bg px-4 py-2 rounded-md font-semibold"
                disabled={createMut.isLoading}
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-semibold">Delete product</h3>
            <p className="text-muted">
              Are you sure you want to delete <span className="text-text font-semibold">{confirmDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-md border border-border text-muted"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-md bg-red-500 text-text"
                onClick={() => deleteMut.mutate(confirmDelete.id)}
                disabled={deleteMut.isLoading}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;

