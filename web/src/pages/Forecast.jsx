import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCampaigns,
  fetchCampaignInputs,
  fetchCampaignForecast,
} from "../api/campaigns";
import { fetchProducts } from "../api/products";
import { useCurrency } from "../hooks/useCurrency";

const niceMonth = (label) => {
  const [y, m] = (label || "").split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!y || !m) return label || "";
  return `${names[m - 1]} ${y}`;
};

const monthDiffInclusive = (startMonthLabel, endMonthLabel) => {
  if (!startMonthLabel || !endMonthLabel) return 0;
  const [sy, sm] = startMonthLabel.split("-").map(Number);
  const [ey, em] = endMonthLabel.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return 0;
  const start = sy * 12 + sm;
  const end = ey * 12 + em;
  if (end < start) return 0;
  return end - start + 1;
};

const fmt = (val, currency) => {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(val));
};

const pct = (val) => {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return "--";
  return `${Number(val).toFixed(1)}%`;
};

const Card = ({ title, value, subtitle }) => (
  <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
    <div className="text-sm text-muted">{title}</div>
    <div className="text-2xl font-semibold text-text">{value}</div>
    {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
  </div>
);

const ForecastPage = () => {
  const { currency } = useCurrency();
  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [monthFilter, setMonthFilter] = React.useState("all");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (!selectedCampaign && campaigns.length) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  const { data: inputs } = useQuery({
    queryKey: ["campaignInputs", selectedCampaign?.id],
    queryFn: () => fetchCampaignInputs(selectedCampaign.id),
    enabled: !!selectedCampaign,
  });

  const { data: forecast } = useQuery({
    queryKey: ["campaignForecast", selectedCampaign?.id],
    queryFn: () => fetchCampaignForecast(selectedCampaign.id),
    enabled: !!selectedCampaign,
  });

  const productMap = React.useMemo(
    () =>
      products.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {}),
    [products]
  );

  const marketingCalc = React.useMemo(() => {
    if (!inputs?.quantities) {
      return { marketingComponentUsed: 0, marketingTotalFinal: 0 };
    }
    const overrides = inputs.product_overrides || {};

    let marketingComponentUsed = 0;
    Object.entries(inputs.quantities).forEach(([pid, qty]) => {
      const base = productMap[pid];
      if (!base) return;
      const ov = overrides[pid] || {};
      const perUnitMkt = ov.marketing_cost_bdt ?? base.marketing_cost_bdt ?? 0;
      marketingComponentUsed += Number(qty || 0) * Number(perUnitMkt || 0);
    });

    // Prefer campaign-level total, then explicit override totals, else per-unit*qty fallback.
    const campaignTotal = inputs.campaign?.marketing_total;
    const overrideTotals = Object.values(overrides || {}).reduce((sum, ov) => {
      if (ov.marketing_cost_bdt !== null && ov.marketing_cost_bdt !== undefined) {
        return sum + Number(ov.marketing_cost_bdt || 0);
      }
      return sum;
    }, 0);

    const marketingTotalFinal =
      campaignTotal !== null && campaignTotal !== undefined
        ? Number(campaignTotal || 0)
        : overrideTotals > 0
        ? overrideTotals
        : marketingComponentUsed;

    return { marketingComponentUsed, marketingTotalFinal };
  }, [inputs, productMap]);

  const opexTotal = React.useMemo(() => {
    const list = inputs?.campaign?.attached_opex || [];
    const campStart = inputs?.campaign?.start_date;
    const campEnd = inputs?.campaign?.end_date;
    if (!campStart || !campEnd) {
      return list.reduce((sum, item) => sum + Number(item?.cost_bdt || 0), 0);
    }
    // normalize campaign start/end to YYYY-MM
    const toMonthLabel = (dateStr) => {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}`;
    };
    const campStartMonth = toMonthLabel(campStart);
    const campEndMonth = toMonthLabel(campEnd);
    return list.reduce((sum, item) => {
      const cost = Number(item?.cost_bdt || 0);
      if (!cost) return sum;
      const start = item.start_month || campStartMonth;
      const end = item.end_month || campEndMonth;
      // clamp within campaign window
      const effectiveStart = !campStartMonth ? start : [campStartMonth, start].sort()[1];
      const effectiveEnd = !campEndMonth ? end : [campEndMonth, end].sort().reverse()[0];
      const monthsActive = monthDiffInclusive(effectiveStart, effectiveEnd);
      return sum + cost * (monthsActive || 0);
    }, 0);
  }, [inputs]);

  const totals = forecast?.totals || {};
  const productUnits = totals.campaign_qty || 0;
  const grossRevenue = totals.gross_revenue || 0;
  const effectiveRevenue = totals.effective_revenue || totals.effective_revenue === 0 ? totals.effective_revenue : grossRevenue;

  // Swap per-unit marketing with campaign-level marketing total
  const marketingAdjustedCost =
    (totals.total_cost || 0) - marketingCalc.marketingComponentUsed + marketingCalc.marketingTotalFinal;
  const marketingAdjustedProfit =
    (totals.net_profit || 0) + marketingCalc.marketingComponentUsed - marketingCalc.marketingTotalFinal;

  const totalCost = marketingAdjustedCost + opexTotal;
  const netProfit = marketingAdjustedProfit - opexTotal;
  const netMarginPct = grossRevenue > 0 ? ((netProfit || 0) / grossRevenue) * 100 : 0;

  const monthlyOptions = React.useMemo(() => {
    if (!forecast?.monthly) return [];
    const seen = new Set();
    return forecast.monthly
      .filter((row) => {
        if (seen.has(row.month)) return false;
        seen.add(row.month);
        return true;
      })
      .map((row) => ({ value: row.month, label: row.month_nice || niceMonth(row.month) }));
  }, [forecast]);

  const monthlyRows =
    monthFilter === "all"
      ? forecast?.monthly || []
      : (forecast?.monthly || []).filter((r) => r.month === monthFilter);

  const productSummary = forecast?.product_summary || [];
  const sizeRows = forecast?.size_breakdown || [];

  const unitBreakdown = React.useMemo(() => {
    if (!productSummary.length) return [];
    return productSummary.map((p) => {
      const qty = p.campaign_qty || 1;
      const unitRevenue = qty ? (p.gross_revenue || 0) / qty : 0;
      const unitCost = qty ? (p.total_cost || 0) / qty : 0;
      const unitProfit = unitRevenue - unitCost;
      const unitMargin = unitRevenue ? (unitProfit / unitRevenue) * 100 : 0;
      return {
        ...p,
        unitRevenue,
        unitCost,
        unitProfit,
        unitMargin,
      };
    });
  }, [productSummary]);

  const discountsImpact = React.useMemo(() => {
    if (!forecast?.product_summary) return { gross: 0, effective: 0, delta: 0 };
    const gross = forecast.product_summary.reduce((s, p) => s + (p.gross_revenue || 0), 0);
    const effective = forecast.product_summary.reduce((s, p) => s + (p.effective_revenue || 0), 0);
    return { gross, effective, delta: gross - effective };
  }, [forecast]);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-text">Overall Forecast</div>
            <div className="text-sm text-muted">Read-only analytics for planned campaigns</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">Campaign</label>
            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text"
              value={selectedCampaign?.id || ""}
              onChange={(e) => {
                const next = campaigns.find((c) => c.id === e.target.value);
                setSelectedCampaign(next || null);
                setMonthFilter("all");
              }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card title="Product Units" value={productUnits} />
          <Card title="Gross Revenue" value={fmt(grossRevenue, currency)} />
          <Card title="Effective Revenue (promo/discount/returns)" value={fmt(effectiveRevenue, currency)} />
          <Card title="Total Cost (incl. MKT/OPEX/Packaging)" value={fmt(totalCost, currency)} />
          <Card title="Net Profit" value={fmt(netProfit, currency)} />
          <Card title="Net Margin" value={pct(netMarginPct)} />
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold text-text">Marketing & OPEX</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Marketing Cost (campaign)" value={fmt(marketingCalc.marketingTotalFinal, currency)} />
          <Card title="OPEX (linked)" value={fmt(opexTotal, currency)} />
          <Card title="Total Marketing & OPEX costs" value={fmt(marketingCalc.marketingTotalFinal + opexTotal, currency)} />
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-text">Forecast Output</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Month</label>
            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              disabled={!monthlyOptions.length}
            >
              <option value="all">Full campaign</option>
              {monthlyOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted border-b border-border/60">
              <tr>
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Gross Rev</th>
                <th className="py-2 pr-3">Total Cost</th>
                <th className="py-2 pr-3">Net Profit</th>
                <th className="py-2 pr-3">Net Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {monthlyRows.map((row) => {
                const margin = row.effective_revenue
                  ? (row.net_profit / row.effective_revenue) * 100
                  : 0;
                return (
                  <tr key={`${row.month}-${row.product_id}`}>
                    <td className="py-2 pr-3 text-muted">{row.month_nice || niceMonth(row.month)}</td>
                    <td className="py-2 pr-3">{row.product_name}</td>
                    <td className="py-2 pr-3">{Math.round(row.qty)}</td>
                    <td className="py-2 pr-3">{fmt(row.gross_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(row.total_cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(row.net_profit, currency)}</td>
                    <td className="py-2 pr-3">{pct(margin)}</td>
                  </tr>
                );
              })}
              {!monthlyRows.length && (
                <tr>
                  <td className="py-3 text-muted" colSpan={8}>
                    No forecast data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold text-text">Size Breakdown</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted border-b border-border/60">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2 pr-3">Cost</th>
                <th className="py-2 pr-3">Net Profit</th>
                <th className="py-2 pr-3">Net Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sizeRows.map((r) => {
                const margin = r.effective_revenue
                  ? (r.net_profit / r.effective_revenue) * 100
                  : 0;
                return (
                  <tr key={`${r.product_id}-${r.size}`}>
                    <td className="py-2 pr-3">{r.product_name}</td>
                    <td className="py-2 pr-3">{r.size}</td>
                    <td className="py-2 pr-3">{r.qty}</td>
                    <td className="py-2 pr-3">{fmt(r.effective_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(r.total_cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(r.net_profit, currency)}</td>
                    <td className="py-2 pr-3">{pct(margin)}</td>
                  </tr>
                );
              })}
              {!sizeRows.length && (
                <tr>
                  <td className="py-3 text-muted" colSpan={7}>
                    No size-level data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold text-text">Unit Breakdown</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted border-b border-border/60">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Unit Rev</th>
                <th className="py-2 pr-3">Unit Cost</th>
                <th className="py-2 pr-3">Unit Profit</th>
                <th className="py-2 pr-3">Unit Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {unitBreakdown.map((r) => (
                <tr key={r.product_id}>
                  <td className="py-2 pr-3">{r.product_name}</td>
                  <td className="py-2 pr-3">{fmt(r.unitRevenue, currency)}</td>
                  <td className="py-2 pr-3">{fmt(r.unitCost, currency)}</td>
                  <td className="py-2 pr-3">{fmt(r.unitProfit, currency)}</td>
                  <td className="py-2 pr-3">{pct(r.unitMargin)}</td>
                </tr>
              ))}
              {!unitBreakdown.length && (
                <tr>
                  <td className="py-3 text-muted" colSpan={5}>
                    No unit metrics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold text-text">Discounts & Returns Impact</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Gross (no discounts)</span>
            <span className="font-medium text-text">{fmt(discountsImpact.gross, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Effective (after discounts/returns)</span>
            <span className="font-medium text-text">{fmt(discountsImpact.effective, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Discount delta</span>
            <span className="font-medium text-text">{fmt(discountsImpact.delta, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Returns impact</span>
            <span className="font-medium text-text">Included in effective revenue</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-4">
        <div className="text-lg font-semibold text-text">Visual Pulse</div>
        <div className="space-y-3">
          {(monthlyOptions.length ? monthlyOptions : [{ value: "all", label: "All" }]).map((m) => {
            const rows =
              m.value === "all"
                ? forecast?.monthly || []
                : (forecast?.monthly || []).filter((r) => r.month === m.value);
            const revenue = rows.reduce((s, r) => s + (r.effective_revenue || 0), 0);
            const profit = rows.reduce((s, r) => s + (r.net_profit || 0), 0);
            const barPct = revenue > 0 ? Math.min(100, Math.max(0, (profit / revenue) * 100 + 50)) : 50;
            return (
              <div key={m.value} className="border border-border/60 rounded-lg p-4 bg-surface space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted">{m.label}</div>
                  <div className="text-xs text-muted">Revenue vs Profit</div>
                </div>
                <div className="text-base font-semibold text-text">{fmt(revenue, currency)} revenue</div>
                <div className="text-sm text-muted">Profit {fmt(profit, currency)}</div>
                <div className="h-2 rounded-full bg-border/60 overflow-hidden">
                  <div className="h-full bg-emerald-400/80" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
