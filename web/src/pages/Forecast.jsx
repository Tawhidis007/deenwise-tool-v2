import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
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

const niceTickStep = (maxValue, ticks = 5) => {
  if (maxValue <= 0) return 1;
  const rough = maxValue / (ticks - 1);
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const digit = rough / pow10;
  let step = pow10;
  if (digit >= 5) step = 5 * pow10;
  else if (digit >= 2) step = 2 * pow10;
  return step;
};

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describePieSlice = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

const describeDonutSlice = (cx, cy, r, ir, startAngle, endAngle) => {
  const startOuter = polarToCartesian(cx, cy, r, endAngle);
  const endOuter = polarToCartesian(cx, cy, r, startAngle);
  const startInner = polarToCartesian(cx, cy, ir, startAngle);
  const endInner = polarToCartesian(cx, cy, ir, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${ir} ${ir} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
};

const InfoTooltip = ({ text }) => {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef(null);

  const show = () => {
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 4000);
  };

  const hide = () => {
    setOpen(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="ml-2 h-5 w-5 rounded-full border border-border/70 text-[10px] font-semibold text-muted hover:text-text"
        aria-label="More info"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        i
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-10 w-52 rounded-md border border-border/70 bg-surface px-2 py-1 text-[11px] text-muted shadow-md">
          {text}
        </span>
      )}
    </span>
  );
};

const Card = ({ title, value, subtitle, help }) => (
  <div className="bg-card border border-border/60 rounded-xl p-4 flex h-full flex-col gap-2 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm text-muted leading-snug whitespace-normal break-words">{title}</div>
      {help && <InfoTooltip text={help} />}
    </div>
    <div className="text-2xl font-semibold text-text whitespace-nowrap">{value}</div>
    {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
  </div>
);

const ForecastPage = () => {
  const { currency } = useCurrency();
  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [monthFilter, setMonthFilter] = React.useState("all");
  const [sizeProductFilter, setSizeProductFilter] = React.useState("all");
  const [impactFilter, setImpactFilter] = React.useState("all");
  const [pulseFilter, setPulseFilter] = React.useState("campaign");
  const [showForecastDefs, setShowForecastDefs] = React.useState(false);
  const [showSizeDefs, setShowSizeDefs] = React.useState(false);
  const [showUnitDefs, setShowUnitDefs] = React.useState(false);
  const [showImpactDefs, setShowImpactDefs] = React.useState(false);
  const [showForecastChart, setShowForecastChart] = React.useState(true);

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
  const productUnits = Number(totals.campaign_qty || 0);
  const grossRevenue = Number(totals.gross_revenue || 0);
  const effectiveRevenue = totals.effective_revenue || totals.effective_revenue === 0 ? totals.effective_revenue : grossRevenue;

  // Swap per-unit marketing with campaign-level marketing total (avoid NaN)
  const baseCost = Number(totals.total_cost || 0);
  const baseProfit = Number(totals.net_profit || 0);
  const mPerUnit = Number(marketingCalc.marketingComponentUsed || 0);
  const mCampaign = Number(marketingCalc.marketingTotalFinal || 0);
  const baseOpex = Number(opexTotal || 0);

  const marketingAdjustedCost = baseCost - mPerUnit + mCampaign;
  const marketingAdjustedProfit = baseProfit + mPerUnit - mCampaign;

  const totalCost = marketingAdjustedCost + baseOpex;
  const netProfit = marketingAdjustedProfit - baseOpex;
  const netMarginPct = effectiveRevenue > 0 ? ((netProfit || 0) / effectiveRevenue) * 100 : 0;
  const marketingEfficiencyRatio =
    marketingCalc.marketingTotalFinal > 0
      ? effectiveRevenue / marketingCalc.marketingTotalFinal
      : null;
  const revenueLeakagePct = grossRevenue > 0 ? ((grossRevenue - effectiveRevenue) / grossRevenue) * 100 : null;
  const netMarginValue = effectiveRevenue > 0 ? ((netProfit || 0) / effectiveRevenue) * 100 : null;

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

  const baseRows =
    monthFilter === "all"
      ? // aggregate per product for full campaign
        (forecast?.product_summary || []).map((p) => ({
          month: "campaign",
          month_nice: "Full Campaign",
          product_id: p.product_id,
          product_name: p.product_name,
          qty: p.campaign_qty,
          gross_revenue: p.gross_revenue,
          effective_revenue: p.effective_revenue,
          total_cost: p.total_cost,
          net_profit: p.net_profit,
        }))
      : (forecast?.monthly || []).filter((r) => r.month === monthFilter);

  const buildAdjustedRows = React.useCallback(
    (rows) => {
      if (!rows.length) return [];
      const perUnitMarketing = (pid) => {
        const base = productMap[pid];
        if (!base) return 0;
        const ov = (inputs?.product_overrides || {})[pid] || {};
        return Number(ov.marketing_cost_bdt ?? base.marketing_cost_bdt ?? 0);
      };

      const rowsWithComponents = rows.map((row) => {
        const mPerUnit = perUnitMarketing(row.product_id);
        const marketingUsed = Number(row.qty || 0) * mPerUnit;
        const baseCost = Number(row.total_cost || 0);
        const costNoMkt = baseCost - marketingUsed;
        return { ...row, marketingUsed, costNoMkt };
      });

      const totalMarketingUsed = rowsWithComponents.reduce((s, r) => s + r.marketingUsed, 0);
      const totalQty = rowsWithComponents.reduce((s, r) => s + Number(r.qty || 0), 0);

      const allocMarketing = (row) => {
        if (totalMarketingUsed > 0) {
          return (row.marketingUsed / totalMarketingUsed) * marketingCalc.marketingTotalFinal;
        }
        if (totalQty > 0) {
          return (Number(row.qty || 0) / totalQty) * marketingCalc.marketingTotalFinal;
        }
        return 0;
      };

      const allocOpex = (row) => {
        if (totalQty > 0) {
          return (Number(row.qty || 0) / totalQty) * opexTotal;
        }
        return 0;
      };

      return rowsWithComponents.map((row) => {
        const marketingShare = allocMarketing(row);
        const opexShare = allocOpex(row);
        const adjustedCost = row.costNoMkt + marketingShare + opexShare;
        const baseProfit = Number(row.net_profit || 0);
        const adjustedProfit = baseProfit + row.marketingUsed - marketingShare - opexShare;
        return {
          ...row,
          adjustedCost,
          adjustedProfit,
        };
      });
    },
    [productMap, inputs, marketingCalc, opexTotal]
  );

  const campaignUnitCost = productUnits > 0 ? totalCost / productUnits : 0;

  // Allocate campaign totals proportionally by quantity for monthly/product rows.
  const displayRows = React.useMemo(
    () =>
      baseRows.map((row) => {
        const qty = Number(row.qty || 0);
        const adjustedCost = campaignUnitCost * qty;
        const effRev = Number(row.effective_revenue ?? row.gross_revenue ?? 0);
        const adjustedProfit = effRev - adjustedCost;
        return {
          ...row,
          adjustedCost,
          adjustedProfit,
        };
      }),
    [baseRows, campaignUnitCost]
  );

  const productSummary = forecast?.product_summary || [];
  const sizeRows = forecast?.size_breakdown || [];

  const adjustedProductTotals = React.useMemo(() => {
    if (!productSummary.length) return {};

    const perUnitMarketing = (pid) => {
      const base = productMap[pid];
      if (!base) return 0;
      const ov = (inputs?.product_overrides || {})[pid] || {};
      return Number(ov.marketing_cost_bdt ?? base.marketing_cost_bdt ?? 0);
    };

    const rowsWithComponents = productSummary.map((row) => {
      const mPerUnit = perUnitMarketing(row.product_id);
      const marketingUsed = Number(row.campaign_qty || 0) * mPerUnit;
      const baseCost = Number(row.total_cost || 0);
      const costNoMkt = baseCost - marketingUsed;
      return { ...row, marketingUsed, costNoMkt };
    });

    const totalMarketingUsed = rowsWithComponents.reduce((s, r) => s + r.marketingUsed, 0);
    const totalQty = rowsWithComponents.reduce((s, r) => s + Number(r.campaign_qty || 0), 0);

    const allocMarketing = (row) => {
      if (totalMarketingUsed > 0) {
        return (row.marketingUsed / totalMarketingUsed) * marketingCalc.marketingTotalFinal;
      }
      if (totalQty > 0) {
        return (Number(row.campaign_qty || 0) / totalQty) * marketingCalc.marketingTotalFinal;
      }
      return 0;
    };

    const allocOpex = (row) => {
      if (totalQty > 0) {
        return (Number(row.campaign_qty || 0) / totalQty) * opexTotal;
      }
      return 0;
    };

    return rowsWithComponents.reduce((acc, row) => {
      const marketingShare = allocMarketing(row);
      const opexShare = allocOpex(row);
      const adjustedCost = row.costNoMkt + marketingShare + opexShare;
      const adjustedProfit = Number(row.net_profit || 0) + row.marketingUsed - marketingShare - opexShare;
      acc[row.product_id] = {
        campaign_qty: Number(row.campaign_qty || 0),
        effective_revenue: Number(row.effective_revenue || 0),
        total_cost: adjustedCost,
        net_profit: adjustedProfit,
      };
      return acc;
    }, {});
  }, [productSummary, productMap, inputs, marketingCalc, opexTotal]);

  const unitBreakdown = React.useMemo(() => {
    if (!productSummary.length) return [];
    return productSummary.map((p) => {
      const adjusted = adjustedProductTotals[p.product_id];
      const qty = adjusted?.campaign_qty || p.campaign_qty || 1;
      const base = productMap[p.product_id];
      const ov = (inputs?.product_overrides || {})[p.product_id] || {};
      const packaging = Number(ov.packaging_cost_bdt ?? base?.packaging_cost_bdt ?? 0);
      const manufacturing = Number(base?.manufacturing_cost_bdt ?? 0);
      const factoryUnitCost = qty ? (packaging + manufacturing) : 0;
      const unitRevenue = qty ? (adjusted?.effective_revenue ?? p.effective_revenue ?? 0) / qty : 0;
      const unitCost = qty ? (adjusted?.total_cost ?? p.total_cost ?? 0) / qty : 0;
      const unitProfit = qty ? (adjusted?.net_profit ?? p.net_profit ?? 0) / qty : 0;
      const unitMargin = unitRevenue ? (unitProfit / unitRevenue) * 100 : 0;
      return {
        ...p,
        factoryUnitCost,
        unitRevenue,
        unitCost,
        unitProfit,
        unitMargin,
      };
    });
  }, [productSummary, adjustedProductTotals, productMap, inputs]);

  const discountsImpact = React.useMemo(() => {
    if (!productSummary.length) {
      return { gross: 0, effective: 0, discounted: 0, discountImpact: 0, returnsImpact: 0 };
    }
    const overrides = inputs?.product_overrides || {};
    const sums = productSummary.reduce(
      (acc, p) => {
        acc.gross += Number(p.gross_revenue || 0);
        acc.effective += Number(p.effective_revenue || 0);
        const base = productMap[p.product_id];
        const ov = overrides[p.product_id] || {};
        const discountRate = Number(
          ov.discount_rate ?? base?.discount_rate ?? 0
        );
        const price = Number(base?.price_bdt ?? 0);
        const qty = Number(p.campaign_qty || 0);
        const discountedRevenue = price * (1 - (discountRate || 0)) * qty;
        acc.discounted += Number.isNaN(discountedRevenue) ? 0 : discountedRevenue;
        return acc;
      },
      { gross: 0, effective: 0, discounted: 0 }
    );
    const discountImpact = sums.gross - sums.discounted;
    const returnsImpact = sums.discounted - sums.effective;
    return { ...sums, discountImpact, returnsImpact };
  }, [productSummary, inputs, productMap]);

  const revenueAllocation = React.useMemo(() => {
    const gross = Number(grossRevenue || 0);
    const overrides = inputs?.product_overrides || {};
    let manufacturing = 0;
    let packaging = 0;
    productSummary.forEach((p) => {
      const base = productMap[p.product_id];
      if (!base) return;
      const qty = Number(p.campaign_qty || 0);
      manufacturing += Number(base.manufacturing_cost_bdt || 0) * qty;
      const ov = overrides[p.product_id] || {};
      const packagingCost = Number(ov.packaging_cost_bdt ?? base.packaging_cost_bdt ?? 0);
      packaging += packagingCost * qty;
    });
    const marketing = Number(marketingCalc.marketingTotalFinal || 0);
    const opex = Number(opexTotal || 0);
    const discountImpact = Number(discountsImpact.discountImpact || 0);
    const returnsImpact = Number(discountsImpact.returnsImpact || 0);
    const totalDeductions =
      manufacturing + packaging + marketing + opex + discountImpact + returnsImpact;
    const profit = gross - totalDeductions;
    const segments = [
      { key: "manufacturing", label: "Manufacturing Cost", value: manufacturing, color: "#6b7280" },
      { key: "packaging", label: "Packaging Cost", value: packaging, color: "#9ca3af" },
      { key: "marketing", label: "Marketing Cost", value: marketing, color: "#b45309" },
      { key: "opex", label: "OPEX", value: opex, color: "#92400e" },
      { key: "discounts", label: "Discount Impact", value: discountImpact, color: "#f59e0b" },
      { key: "returns", label: "Returns Impact", value: returnsImpact, color: "#ef4444" },
      { key: "profit", label: "Net Profit (as % of Gross)", value: profit, color: "#10b981", isProfit: true },
    ];
    const normalized = segments.map((segment) => ({
      ...segment,
      pct: gross > 0 ? segment.value / gross : 0,
    }));
    return { gross, segments: normalized };
  }, [grossRevenue, inputs, productSummary, productMap, marketingCalc, opexTotal, discountsImpact]);

  const sizeRowsAdjusted = React.useMemo(() => {
    if (!sizeRows.length || !productSummary.length) return [];

    const perUnitMarketing = (pid) => {
      const base = productMap[pid];
      if (!base) return 0;
      const ov = (inputs?.product_overrides || {})[pid] || {};
      return Number(ov.marketing_cost_bdt ?? base.marketing_cost_bdt ?? 0);
    };

    const rowsWithComponents = productSummary.map((row) => {
      const mPerUnit = perUnitMarketing(row.product_id);
      const marketingUsed = Number(row.campaign_qty || 0) * mPerUnit;
      const baseCost = Number(row.total_cost || 0);
      const costNoMkt = baseCost - marketingUsed;
      return { ...row, marketingUsed, costNoMkt };
    });

    const totalMarketingUsed = rowsWithComponents.reduce((s, r) => s + r.marketingUsed, 0);
    const totalQty = rowsWithComponents.reduce((s, r) => s + Number(r.campaign_qty || 0), 0);

    const allocMarketing = (row) => {
      if (totalMarketingUsed > 0) {
        return (row.marketingUsed / totalMarketingUsed) * marketingCalc.marketingTotalFinal;
      }
      if (totalQty > 0) {
        return (Number(row.campaign_qty || 0) / totalQty) * marketingCalc.marketingTotalFinal;
      }
      return 0;
    };

    const allocOpex = (row) => {
      if (totalQty > 0) {
        return (Number(row.campaign_qty || 0) / totalQty) * opexTotal;
      }
      return 0;
    };

    const adjustedProductMap = rowsWithComponents.reduce((acc, row) => {
      const marketingShare = allocMarketing(row);
      const opexShare = allocOpex(row);
      const adjustedCost = row.costNoMkt + marketingShare + opexShare;
      const adjustedProfit = Number(row.net_profit || 0) + row.marketingUsed - marketingShare - opexShare;
      acc[row.product_id] = {
        campaign_qty: Number(row.campaign_qty || 0),
        effective_revenue: Number(row.effective_revenue || 0),
        total_cost: adjustedCost,
        net_profit: adjustedProfit,
      };
      return acc;
    }, {});

    const factoryCostByProduct = productSummary.reduce((acc, row) => {
      const base = productMap[row.product_id];
      if (!base) return acc;
      const ov = (inputs?.product_overrides || {})[row.product_id] || {};
      const packaging = Number(ov.packaging_cost_bdt ?? base.packaging_cost_bdt ?? 0);
      const manufacturing = Number(base.manufacturing_cost_bdt ?? 0);
      const perUnitFactory = packaging + manufacturing;
      acc[row.product_id] = perUnitFactory * Number(row.campaign_qty || 0);
      return acc;
    }, {});

    const sizeTotalsByProduct = sizeRows.reduce((acc, row) => {
      acc[row.product_id] = (acc[row.product_id] || 0) + Number(row.qty || 0);
      return acc;
    }, {});

    return sizeRows.map((row) => {
      const productTotals = adjustedProductMap[row.product_id];
      if (!productTotals) return row;
      const sizeQty = Number(row.qty || 0);
      const denomQty = productTotals.campaign_qty > 0 ? productTotals.campaign_qty : (sizeTotalsByProduct[row.product_id] || 0);
      if (denomQty <= 0 || sizeQty <= 0) return row;
      const share = sizeQty / denomQty;
      const totalCost = productTotals.total_cost * share;
      const factoryCost = (factoryCostByProduct[row.product_id] || 0) * share;
      const effectiveRevenue = Number(row.effective_revenue || 0);
      return {
        ...row,
        factory_cost: factoryCost,
        total_cost: totalCost,
        net_profit: effectiveRevenue - totalCost,
      };
    });
  }, [sizeRows, productSummary, productMap, inputs, marketingCalc, opexTotal]);

  const sizeProductOptions = React.useMemo(() => {
    if (!sizeRowsAdjusted.length) return [];
    const map = new Map();
    sizeRowsAdjusted.forEach((row) => {
      if (!row.product_id) return;
      if (!map.has(row.product_id)) {
        map.set(row.product_id, row.product_name || row.product_id);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sizeRowsAdjusted]);

  const sizeRowsFiltered = React.useMemo(() => {
    if (sizeProductFilter === "all") return sizeRowsAdjusted;
    return sizeRowsAdjusted.filter((row) => row.product_id === sizeProductFilter);
  }, [sizeRowsAdjusted, sizeProductFilter]);

  const pulseData = React.useMemo(() => {
    if (!forecast?.monthly || !forecast.monthly.length) return [];
    const adjustedMonthlyRows = buildAdjustedRows(forecast.monthly);
    const map = {};
    adjustedMonthlyRows.forEach((r) => {
      if (!map[r.month]) {
        map[r.month] = {
          month: r.month,
          month_nice: r.month_nice || niceMonth(r.month),
          revenue: 0,
          cost: 0,
          profit: 0,
          qty: 0,
        };
      }
      map[r.month].revenue += Number(r.effective_revenue || 0);
      map[r.month].cost += Number(r.adjustedCost ?? r.total_cost ?? 0);
      map[r.month].profit += Number(r.adjustedProfit ?? r.net_profit ?? 0);
      map[r.month].qty += Number(r.qty || 0);
    });
    const arr = Object.values(map);
    const totalAll = arr.reduce(
      (acc, m) => ({
        month: "campaign",
        month_nice: "Full Campaign",
        revenue: acc.revenue + m.revenue,
        cost: acc.cost + m.cost,
        profit: acc.profit + m.profit,
        qty: acc.qty + m.qty,
      }),
      { month: "campaign", month_nice: "Full Campaign", revenue: 0, cost: 0, profit: 0, qty: 0 }
    );
    return [totalAll, ...arr];
  }, [forecast, buildAdjustedRows]);

  const pulseOptions = React.useMemo(() => {
    if (!pulseData.length) return [];
    return pulseData.map((m) => ({
      value: m.month,
      label: m.month === "campaign" ? "Full campaign" : m.month_nice,
    }));
  }, [pulseData]);

  const pulseFiltered = React.useMemo(() => {
    if (pulseFilter === "all") return pulseData;
    return pulseData.filter((m) => m.month === pulseFilter);
  }, [pulseData, pulseFilter]);

  const productBarData = React.useMemo(() => {
    if (!displayRows.length) return [];
    const aggregates = displayRows.reduce((acc, row) => {
      const key = row.product_id;
      if (!acc[key]) {
        acc[key] = {
          product_id: row.product_id,
          product_name: row.product_name,
          gross: 0,
          effective: 0,
          totalCost: 0,
        };
      }
      acc[key].gross += Number(row.gross_revenue || 0);
      acc[key].effective += Number(row.effective_revenue || 0);
      acc[key].totalCost += Number(row.adjustedCost ?? row.total_cost ?? 0);
      return acc;
    }, {});
    return Object.values(aggregates);
  }, [displayRows]);

  const productBarDomain = React.useMemo(() => {
    if (!productBarData.length) return { max: 0, ticks: [0] };
    const maxGross = productBarData.reduce((max, row) => Math.max(max, row.gross), 0);
    const step = niceTickStep(maxGross || 1, 5);
    const max = maxGross > 0 ? Math.ceil(maxGross / step) * step : 0;
    const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
    return { max, ticks: ticks.length ? ticks : [0] };
  }, [productBarData]);

  const allocationSlices = React.useMemo(() => {
    const segments = revenueAllocation.segments;
    const totalPct = segments.reduce((sum, seg) => sum + Math.max(0, seg.pct), 0) || 1;
    let cursor = 0;
    return segments.map((seg) => {
      const pctDisplay = Math.max(0, seg.pct) / totalPct;
      const startAngle = cursor * 360;
      const endAngle = (cursor + pctDisplay) * 360;
      cursor += pctDisplay;
      return { ...seg, pctDisplay, startAngle, endAngle };
    });
  }, [revenueAllocation]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-accent">FINANCIAL SUMMARY</p>
          <div className="text-3xl font-semibold text-text">Campaign Performance Overview</div>
          <p className="text-sm text-muted">
            Executive-level view of revenue, costs, profit, and efficiency metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="space-y-1">
          <div className="text-lg font-semibold text-text">Overall Forecast</div>
          <div className="text-sm text-muted">Read-only analytics for planned campaigns</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 [@media(min-width:1200px)]:grid-cols-4 auto-rows-fr gap-4">
          <Card
            title="Product Units"
            value={productUnits}
            help="Total units planned across all products for the campaign."
          />
          <Card
            title="Gross Revenue"
            value={fmt(grossRevenue, currency)}
            help="Sales before discounts and returns."
          />
          <Card
            title="Effective Revenue (after discounts & returns)"
            value={fmt(effectiveRevenue, currency)}
            help="Sales after discounts and returns."
          />
          <Card
            title="Revenue Leakage Rate"
            value={
              revenueLeakagePct !== null ? (
                <span>
                  {revenueLeakagePct.toFixed(1)}
                  <span className="text-sm text-muted">%</span>
                </span>
              ) : (
                "--"
              )
            }
            help="Share of gross revenue lost to discounts and returns."
          />
          <Card
            title="Total Cost (incl. Marketing, OPEX, Packaging)"
            value={fmt(totalCost, currency)}
            help="All costs including factory, marketing, and OPEX."
          />
          <Card title="Net Profit" value={fmt(netProfit, currency)} help="Effective revenue minus total cost." />
          <Card
            title="Net Margin"
            value={
              netMarginValue !== null ? (
                <span>
                  {netMarginValue.toFixed(1)}
                  <span className="text-sm text-muted">%</span>
                </span>
              ) : (
                "--"
              )
            }
            help="Net profit as a share of effective revenue."
          />
          <Card
            title="Marketing Efficiency Ratio"
            value={
              marketingEfficiencyRatio !== null ? (
                <span>
                  {marketingEfficiencyRatio.toFixed(2)}
                  <span className="text-sm text-muted">x</span>
                </span>
              ) : (
                "--"
              )
            }
            help="Effective revenue earned per 1 unit of marketing cost."
          />
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
        <div className="bg-surface border border-border/60 rounded-lg p-3 text-xs text-muted space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-text">Definitions</div>
            <button
              type="button"
              className="text-xs text-muted border border-border/60 rounded-md px-2 py-1 bg-card hover:bg-border/40"
              onClick={() => setShowForecastDefs((prev) => !prev)}
            >
              {showForecastDefs ? "Collapse" : "Expand"}
            </button>
          </div>
          {showForecastDefs && (
            <div className="space-y-2">
              <div>
                <span className="font-medium text-text">Effective Revenue</span> Revenue after discounts and returns.
              </div>
              <div>
                <span className="font-medium text-text">Total Cost</span> Fully loaded cost allocated from campaign totals.
              </div>
              <div>
                <span className="font-medium text-text">Net Profit</span> Effective Revenue minus Total Cost.
              </div>
              <div>
                <span className="font-medium text-text">Net Margin</span> Net Profit as a percentage of Effective Revenue.
              </div>
            </div>
          )}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted border-b border-border/60">
              <tr>
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Gross Rev</th>
                <th className="py-2 pr-3">Effective Rev (promo/discount/returns)</th>
                <th className="py-2 pr-3">Total Cost</th>
                <th className="py-2 pr-3">Net Profit</th>
                <th className="py-2 pr-3">Net Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayRows.map((row) => {
                const effRev = Number(row.effective_revenue ?? row.gross_revenue ?? 0);
                const cost = Number(row.adjustedCost ?? row.total_cost ?? 0);
                const profit = Number(row.adjustedProfit ?? row.net_profit ?? 0);
                const margin = effRev ? (profit / effRev) * 100 : 0;
                return (
                  <tr key={`${row.month}-${row.product_id}`}>
                    <td className="py-2 pr-3 text-muted">{row.month_nice || niceMonth(row.month)}</td>
                    <td className="py-2 pr-3">{row.product_name}</td>
                    <td className="py-2 pr-3">{Math.round(row.qty)}</td>
                    <td className="py-2 pr-3">{fmt(row.gross_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(row.effective_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(profit, currency)}</td>
                    <td className="py-2 pr-3">{pct(margin)}</td>
                  </tr>
                );
              })}
              {!displayRows.length && (
                <tr>
                  <td className="py-3 text-muted" colSpan={8}>
                    No forecast data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
          <div className="text-base font-semibold text-text">Revenue vs Cost by Product Visual</div>
            <button
              type="button"
              className="text-xs text-muted border border-border/60 rounded-md px-2 py-1 bg-card hover:bg-border/40"
              onClick={() => setShowForecastChart((prev) => !prev)}
            >
              {showForecastChart ? "Collapse" : "Expand"}
            </button>
          </div>
          <div className="text-sm text-muted max-w-xl">
            Gross revenue, effective revenue, and total cost comparison
          </div>
          {showForecastChart && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-sky-300" />
                  <span>Gross Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                  <span>Effective Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-amber-500" />
                  <span>Total Cost</span>
                </div>
              </div>
              <div className="border border-border/60 rounded-lg p-4 bg-surface">
                {productBarData.length ? (
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productBarData}
                    margin={{ top: 84, right: 16, left: 8, bottom: 32 }}
                        barCategoryGap="12%"
                        barGap={4}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                        <XAxis
                          dataKey="product_name"
                          tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 11 }}
                          axisLine={{ stroke: "rgba(148,163,184,0.5)" }}
                          tickLine={{ stroke: "rgba(148,163,184,0.5)" }}
                          interval={0}
                          tickMargin={8}
                        />
                        <YAxis
                          domain={[0, productBarDomain.max]}
                          ticks={productBarDomain.ticks}
                          tickFormatter={(val) => fmt(val, currency)}
                          tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 11 }}
                          axisLine={{ stroke: "rgba(148,163,184,0.5)" }}
                          tickLine={{ stroke: "rgba(148,163,184,0.5)" }}
                          width={72}
                        />
                    <Tooltip
                      formatter={(val, name) => [fmt(val, currency), name]}
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        borderColor: "rgba(148,163,184,0.4)",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      shared={false}
                      cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    />
                    <Bar dataKey="gross" name="Gross Revenue" fill="#7dd3fc" barSize={26} maxBarSize={28}>
                      <LabelList
                        dataKey="gross"
                        position="top"
                        formatter={(val) => fmt(val, currency)}
                        fill="rgba(226,232,240,0.9)"
                        fontSize={10}
                        offset={28}
                        angle={-90}
                        textAnchor="middle"
                      />
                    </Bar>
                    <Bar dataKey="effective" name="Effective Revenue" fill="#34d399" barSize={26} maxBarSize={28}>
                      <LabelList
                        dataKey="effective"
                        position="top"
                        formatter={(val) => fmt(val, currency)}
                        fill="rgba(226,232,240,0.9)"
                        fontSize={10}
                        offset={28}
                        angle={-90}
                        textAnchor="middle"
                      />
                    </Bar>
                    <Bar dataKey="totalCost" name="Total Cost" fill="rgba(245,158,11,0.8)" barSize={26} maxBarSize={28}>
                      <LabelList
                        dataKey="totalCost"
                        position="top"
                        formatter={(val) => fmt(val, currency)}
                        fill="rgba(226,232,240,0.9)"
                        fontSize={10}
                        offset={28}
                        angle={-90}
                        textAnchor="middle"
                      />
                    </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-sm text-muted">No product data available.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-text">Size Breakdown</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Product</label>
            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text"
              value={sizeProductFilter}
              onChange={(e) => setSizeProductFilter(e.target.value)}
              disabled={!sizeProductOptions.length}
            >
              <option value="all">All products</option>
              {sizeProductOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-lg p-3 text-xs text-muted space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-text">Definitions</div>
            <button
              type="button"
              className="text-xs text-muted border border-border/60 rounded-md px-2 py-1 bg-card hover:bg-border/40"
              onClick={() => setShowSizeDefs((prev) => !prev)}
            >
              {showSizeDefs ? "Collapse" : "Expand"}
            </button>
          </div>
          {showSizeDefs && (
            <div className="space-y-2">
              <div>
                <span className="font-medium text-text">Factory Cost</span> Direct cost of producing the item
                (manufacturing + packaging). Excludes marketing and business overheads.
              </div>
              <div>
                <span className="font-medium text-text">Total Cost (Fully Loaded)</span> Factory Cost plus allocated
                marketing spend and operational overheads (OPEX). Represents the true cost to the business per unit.
              </div>
              <div>
                <span className="font-medium text-text">Revenue</span> Effective revenue after discounts and returns.
              </div>
              <div>
                <span className="font-medium text-text">Net Profit</span> Revenue minus Total Cost (Fully Loaded).
              </div>
              <div>
                <span className="font-medium text-text">Net Margin</span> Net Profit as a percentage of Revenue.
              </div>
            </div>
          )}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted border-b border-border/60">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2 pr-3">Factory Cost</th>
                <th className="py-2 pr-3">Total Cost (Fully Loaded)</th>
                <th className="py-2 pr-3">Net Profit</th>
                <th className="py-2 pr-3">Net Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sizeRowsFiltered.map((r) => {
                const margin = r.effective_revenue
                  ? (r.net_profit / r.effective_revenue) * 100
                  : 0;
                return (
                  <tr key={`${r.product_id}-${r.size}`}>
                    <td className="py-2 pr-3">{r.product_name}</td>
                    <td className="py-2 pr-3">{r.size}</td>
                    <td className="py-2 pr-3">{r.qty}</td>
                    <td className="py-2 pr-3">{fmt(r.effective_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(r.factory_cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(r.total_cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(r.net_profit, currency)}</td>
                    <td className="py-2 pr-3">{pct(margin)}</td>
                  </tr>
                );
              })}
              {!sizeRowsFiltered.length && (
                <tr>
                  <td className="py-3 text-muted" colSpan={8}>
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
        <div className="bg-surface border border-border/60 rounded-lg p-3 text-xs text-muted space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-text">Definitions</div>
            <button
              type="button"
              className="text-xs text-muted border border-border/60 rounded-md px-2 py-1 bg-card hover:bg-border/40"
              onClick={() => setShowUnitDefs((prev) => !prev)}
            >
              {showUnitDefs ? "Collapse" : "Expand"}
            </button>
          </div>
          {showUnitDefs && (
            <div className="space-y-2">
              <div>
                <span className="font-medium text-text">Factory Unit Cost</span> Direct cost to produce a single unit
                (manufacturing + packaging). Excludes marketing and operational overheads.
              </div>
              <div>
                <span className="font-medium text-text">Unit Cost (Fully Loaded)</span> Factory Unit Cost plus allocated
                marketing spend and business overheads (OPEX). Represents the true average cost per unit to the business.
              </div>
            </div>
          )}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted border-b border-border/60">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Unit Rev</th>
                <th className="py-2 pr-3">Factory Unit Cost</th>
                <th className="py-2 pr-3">Unit Cost (Fully Loaded)</th>
                <th className="py-2 pr-3">Unit Profit</th>
                <th className="py-2 pr-3">Unit Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {unitBreakdown.map((r) => (
                <tr key={r.product_id}>
                  <td className="py-2 pr-3">{r.product_name}</td>
                  <td className="py-2 pr-3">{fmt(r.unitRevenue, currency)}</td>
                  <td className="py-2 pr-3">{fmt(r.factoryUnitCost, currency)}</td>
                  <td className="py-2 pr-3">{fmt(r.unitCost, currency)}</td>
                  <td className="py-2 pr-3">{fmt(r.unitProfit, currency)}</td>
                  <td className="py-2 pr-3">{pct(r.unitMargin)}</td>
                </tr>
              ))}
              {!unitBreakdown.length && (
                <tr>
                  <td className="py-3 text-muted" colSpan={6}>
                    No unit metrics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-text">Discounts & Returns Impact</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Filter</label>
            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text"
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="discounts">Discounts only</option>
              <option value="returns">Returns only</option>
            </select>
          </div>
        </div>
        <div className="bg-surface border border-border/60 rounded-lg p-3 text-xs text-muted space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-text">Definitions</div>
            <button
              type="button"
              className="text-xs text-muted border border-border/60 rounded-md px-2 py-1 bg-card hover:bg-border/40"
              onClick={() => setShowImpactDefs((prev) => !prev)}
            >
              {showImpactDefs ? "Collapse" : "Expand"}
            </button>
          </div>
          {showImpactDefs && (
            <div className="space-y-2">
              <div>
                <span className="font-medium text-text">Discount Impact</span> Revenue reduction due to promotional
                discounts applied at point of sale.
              </div>
              <div>
                <span className="font-medium text-text">Returns Impact</span> Expected revenue loss from returned units,
                applied after discounts.
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Gross Revenue (no discounts or returns)</span>
            <span className="font-medium text-text">{fmt(discountsImpact.gross, currency)}</span>
          </div>
          {impactFilter !== "returns" && (
            <div className="flex justify-between">
              <span className="text-muted">Discount Impact</span>
              <span className="font-medium text-text">{fmt(discountsImpact.discountImpact, currency)}</span>
            </div>
          )}
          {impactFilter !== "discounts" && (
            <div className="flex justify-between">
              <span className="text-muted">Returns Impact</span>
              <span className="font-medium text-text">{fmt(discountsImpact.returnsImpact, currency)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Effective Revenue (after discounts and returns)</span>
            <span className="font-medium text-text">{fmt(discountsImpact.effective, currency)}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-4">
        <div className="text-lg font-semibold text-text">Visual Pulse</div>
        <div className="text-sm text-muted">Top-line performance and profitability at a glance.</div>
        <div className="pt-2 space-y-3">
          <div className="text-base font-semibold text-text">Gross Revenue Economics</div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="border border-border/60 rounded-lg p-4 bg-surface space-y-3">
              <div className="text-sm font-semibold text-muted">Gross Revenue Allocation (100% of Gross)</div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-6">
                <svg viewBox="0 0 220 220" className="h-64 w-64 shrink-0">
                  {allocationSlices.map((seg) => (
                    <path
                      key={seg.key}
                      d={describePieSlice(110, 110, 90, seg.startAngle, seg.endAngle)}
                      fill={seg.color}
                    >
                      <title>
                        {seg.label}: {fmt(seg.value, currency)} ({pct(seg.pctDisplay * 100)})
                      </title>
                    </path>
                  ))}
                </svg>
                <div className="w-full max-w-sm space-y-2 text-sm text-muted">
                  {[...allocationSlices]
                    .sort((a, b) => b.pctDisplay - a.pctDisplay)
                    .map((seg) => (
                      <div key={seg.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-text">{seg.label}</span>
                          <span className={seg.isProfit ? "text-emerald-600 font-medium" : ""}>
                            {pct(seg.pctDisplay * 100)} ({fmt(seg.value, currency)})
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${seg.pctDisplay * 100}%`,
                              backgroundColor: seg.isProfit ? "#10b981" : seg.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-semibold text-text">Effective Revenue Split (Cost vs Profit)</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Period</label>
            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text"
              value={pulseFilter}
              onChange={(e) => setPulseFilter(e.target.value)}
              disabled={!pulseOptions.length}
            >
              <option value="all">All</option>
              {pulseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {pulseFiltered.map((m) => {
            const margin = m.revenue ? (m.profit / m.revenue) * 100 : 0;
            let costPct = m.revenue ? Math.min(1, Math.max(0, (m.cost || 0) / m.revenue)) : 1;
            let profitPct = m.revenue ? Math.max(0, (m.profit || 0) / m.revenue) : 0;
            if (profitPct === 0) {
              costPct = 1;
            } else {
              const total = costPct + profitPct;
              if (total > 0) {
                costPct /= total;
                profitPct /= total;
              }
            }
            return (
              <div key={m.month} className="border border-border/60 rounded-lg p-4 bg-surface space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted">{m.month_nice}</div>
                  <div className="text-xs text-muted">Qty {Math.round(m.qty)}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted">Revenue</span>
                    <span className="font-semibold text-text">{fmt(m.revenue, currency)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-muted">Profit</span>
                    <span className="font-semibold text-text">{fmt(m.profit, currency)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex text-xs text-muted">
                    <div className="text-center" style={{ width: `${costPct * 100}%` }}>
                      {pct(costPct * 100)} <span className="text-muted">(Cost)</span>
                    </div>
                    <div className="text-center text-emerald-600" style={{ width: `${profitPct * 100}%` }}>
                      {pct(profitPct * 100)} <span className="text-muted">(Profit)</span>
                    </div>
                  </div>
                  <div className="flex h-2 rounded-full bg-border/40 overflow-hidden">
                    <div className="h-full bg-slate-500/80" style={{ width: `${costPct * 100}%` }} />
                    <div className="h-full bg-emerald-400/80" style={{ width: `${profitPct * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          {!pulseFiltered.length && (
            <div className="text-sm text-muted">No forecast data available.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
