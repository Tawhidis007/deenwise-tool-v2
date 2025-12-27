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
        <span className="absolute right-0 top-6 z-10 w-72 rounded-md border border-border/70 bg-surface px-3 py-2 text-[11px] text-muted shadow-md">
          <div className="max-h-64 overflow-auto pr-1">{text}</div>
        </span>
      )}
    </span>
  );
};

const Card = ({ title, value, subtitle, help }) => (
  <div className="bg-card card-standout border border-border/60 rounded-xl p-4 flex h-full flex-col gap-2 shadow-sm">
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
  const [economicsBasis, setEconomicsBasis] = React.useState("gross");
  const [showUnitEconomics, setShowUnitEconomics] = React.useState(true);

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
    const marketingPlan = inputs.marketing_plan || {};

    let marketingComponentUsed = 0;
    Object.entries(inputs.quantities).forEach(([pid, qty]) => {
      const base = productMap[pid];
      if (!base) return;
      const ov = overrides[pid] || {};
      const perUnitMkt = ov.marketing_cost_bdt ?? base.marketing_cost_bdt ?? 0;
      marketingComponentUsed += Number(qty || 0) * Number(perUnitMkt || 0);
    });

    const marketingPlanTotal = Object.values(marketingPlan).reduce((sum, perProduct) => {
      if (!perProduct) return sum;
      return (
        sum +
        Object.values(perProduct).reduce((innerSum, value) => innerSum + Number(value || 0), 0)
      );
    }, 0);
    const hasMarketingPlan = Object.values(marketingPlan).some(
      (perProduct) => perProduct && Object.keys(perProduct).length > 0
    );

    // Prefer campaign-level total, then explicit override totals, else per-unit*qty fallback.
    const campaignTotal = inputs.campaign?.marketing_total;
    const overrideTotals = Object.values(overrides || {}).reduce((sum, ov) => {
      if (ov.marketing_cost_bdt !== null && ov.marketing_cost_bdt !== undefined) {
        return sum + Number(ov.marketing_cost_bdt || 0);
      }
      return sum;
    }, 0);

    const marketingTotalFinal =
      hasMarketingPlan
        ? Number(marketingPlanTotal || 0)
        : campaignTotal !== null && campaignTotal !== undefined
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
  const revenueLeakageValue = grossRevenue - effectiveRevenue;
  const productSummary = forecast?.product_summary || [];

  const productLines = React.useMemo(
    () =>
      (productSummary || []).map((p) => ({
        id: p.product_id,
        name: p.product_name || p.product_id,
        gross: Number(p.gross_revenue || 0),
        effective: Number(p.effective_revenue || 0),
        qty: Number(p.campaign_qty || 0),
      })),
    [productSummary]
  );

  const opexLines = React.useMemo(() => {
    const list = inputs?.campaign?.attached_opex || [];
    return list.map((item) => ({
      id: item.id,
      name: item.name || "OPEX",
      cost: Number(item.cost_bdt || 0),
    }));
  }, [inputs]);

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

  const getProductUnitCosts = React.useCallback(
    (productId) => {
      const base = productMap[productId];
      if (!base) {
        return { manufacturing: 0, packaging: 0, marketing: 0 };
      }
      const ov = (inputs?.product_overrides || {})[productId] || {};
      const manufacturing = Number(base.manufacturing_cost_bdt ?? 0);
      const packaging = Number(ov.packaging_cost_bdt ?? base.packaging_cost_bdt ?? 0);
      const marketing = Number(ov.marketing_cost_bdt ?? base.marketing_cost_bdt ?? 0);
      return { manufacturing, packaging, marketing };
    },
    [inputs, productMap]
  );

  const factoryPackagingTotal = React.useMemo(
    () =>
      productSummary.reduce((sum, row) => {
        const qty = Number(row.campaign_qty || 0);
        const { manufacturing, packaging } = getProductUnitCosts(row.product_id);
        return sum + qty * (Number(manufacturing || 0) + Number(packaging || 0));
      }, 0),
    [productSummary, getProductUnitCosts]
  );

  // Allocate campaign totals proportionally by quantity for monthly/product rows.
  const displayRows = React.useMemo(() => {
    const campaignMarketingTotal = inputs?.campaign?.marketing_total;
    const marketingPlan = inputs?.marketing_plan || {};
    const productTotals = baseRows.reduce((acc, row) => {
      if (acc[row.product_id]) return acc;
      const qty = Number(row.campaign_qty ?? row.qty ?? 0);
      const { manufacturing, packaging, marketing } = getProductUnitCosts(row.product_id);
      const factoryCost = qty * manufacturing;
      const packagingCost = qty * packaging;
      const marketingPlanByProduct = marketingPlan[row.product_id] || {};
      const marketingPlanTotal = Object.values(marketingPlanByProduct).reduce(
        (sum, val) => sum + Number(val || 0),
        0
      );
      const marketingCost =
        campaignMarketingTotal !== null && campaignMarketingTotal !== undefined
          ? 0
          : marketingPlanTotal > 0
          ? marketingPlanTotal
          : Number(marketing || 0);
      const totalCostLocal = factoryCost + packagingCost + marketingCost;
      acc[row.product_id] = {
        qty,
        totalCost: totalCostLocal,
        factoryCost,
        packagingCost,
        marketingCost,
      };
      return acc;
    }, {});

    const rows = baseRows.map((row) => {
      const qty = Number(row.qty || 0);
      const effRev = Number(row.effective_revenue ?? row.gross_revenue ?? 0);
      const totals = productTotals[row.product_id];
      if (!totals || !totals.qty) {
        return { ...row, totalCost: 0, netProfit: effRev, netMargin: null };
      }
      const marketingPlanByProduct = marketingPlan[row.product_id] || {};
      const marketingForMonth =
        monthFilter !== "all" && marketingPlanByProduct
          ? Number(marketingPlanByProduct[row.month] || 0)
          : null;
      const share = totals.qty > 0 ? qty / totals.qty : 0;
      const totalCost =
        monthFilter === "all"
          ? totals.totalCost
          : totals.factoryCost * share +
            totals.packagingCost * share +
            (campaignMarketingTotal !== null && campaignMarketingTotal !== undefined
              ? 0
              : marketingForMonth !== null
              ? marketingForMonth
              : 0);
      const netProfit = effRev - totalCost;
      const netMargin = effRev ? (netProfit / effRev) * 100 : null;
      return {
        ...row,
        totalCost,
        netProfit,
        netMargin,
        factoryCost: totals.factoryCost * (monthFilter === "all" ? 1 : share),
        packagingCost: totals.packagingCost * (monthFilter === "all" ? 1 : share),
        marketingCost: monthFilter === "all" ? totals.marketingCost : marketingForMonth || 0,
      };
    });

    if (import.meta.env?.DEV && monthFilter === "all" && rows.length) {
      rows.forEach((row) => {
        const qty = Number(row.qty || 0);
        const effRev = Number(row.effective_revenue ?? row.gross_revenue ?? 0);
        const netProfit = effRev - Number(row.totalCost || 0);
        // eslint-disable-next-line no-console
        console.log("Forecast product cost", {
          product_id: row.product_id,
          product_name: row.product_name,
          qty,
          unitFactoryCost: Number(getProductUnitCosts(row.product_id).manufacturing || 0),
          unitPackagingCost: Number(getProductUnitCosts(row.product_id).packaging || 0),
          marketingTotalForProduct: Number(row.marketingCost || 0),
          grossRev: Number(row.gross_revenue || 0),
          effectiveRev: effRev,
          factoryCost: Number(row.factoryCost || 0),
          packagingCost: Number(row.packagingCost || 0),
          productMarketingCost: Number(row.marketingCost || 0),
          totalCost: Number(row.totalCost || 0),
          netProfit,
        });
      });
    }

    return rows;
  }, [baseRows, getProductUnitCosts, monthFilter, inputs]);

  const sizeRows = forecast?.size_breakdown || [];

  const adjustedProductTotals = React.useMemo(() => {
    if (!productSummary.length) return {};
    const totalQty = productUnits || productSummary.reduce((sum, row) => sum + Number(row.campaign_qty || 0), 0);
    return productSummary.reduce((acc, row) => {
      const qty = Number(row.campaign_qty || 0);
      const { manufacturing, packaging, marketing } = getProductUnitCosts(row.product_id);
      const factoryCost = qty * manufacturing;
      const packagingCost = qty * packaging;
      const marketingCost = Number(marketing || 0);
      const opexAlloc = totalQty > 0 ? opexTotal * (qty / totalQty) : 0;
      const totalCost = factoryCost + packagingCost + marketingCost + opexAlloc;
      const effectiveRevenue = Number(row.effective_revenue || 0);
      acc[row.product_id] = {
        campaign_qty: qty,
        effective_revenue: effectiveRevenue,
        total_cost: totalCost,
        net_profit: effectiveRevenue - totalCost,
        factory_cost: factoryCost + packagingCost,
      };
      return acc;
    }, {});
  }, [productSummary, productUnits, getProductUnitCosts, opexTotal]);

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
      const unitCost = factoryUnitCost;
      const unitProfit = unitRevenue - unitCost;
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

  const unitWaterfallData = React.useMemo(() => {
    return unitBreakdown.map((row) => {
      const revenue = Number(row.unitRevenue || 0);
      const factory = Number(row.factoryUnitCost || 0);
      const totalCost = factory;
      const profit = Number(row.unitProfit || 0);
      const base = revenue > 0 ? revenue : 1;
      return {
        product_id: row.product_id,
        product_name: row.product_name,
        revenue,
        factory,
        totalCost,
        profit,
        margin: Number(row.unitMargin || 0),
        factoryPct: Math.min(1, factory / base),
        profitPct: Math.max(0, profit / base),
      };
    });
  }, [unitBreakdown]);

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
    const effective = Number(effectiveRevenue || 0);
    const baseRevenue = economicsBasis === "effective" ? effective : gross;
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
    const effectiveDeductions = manufacturing + packaging + marketing + opex;
    const profit =
      economicsBasis === "effective"
        ? baseRevenue - effectiveDeductions
        : baseRevenue - totalDeductions;
    const segments = economicsBasis === "effective"
      ? [
          { key: "manufacturing", label: "Manufacturing Cost", value: manufacturing, color: "var(--color-manufacturing)" },
          { key: "packaging", label: "Packaging Cost", value: packaging, color: "var(--color-packaging)" },
          { key: "marketing", label: "Marketing Cost", value: marketing, color: "var(--color-marketing)" },
          { key: "opex", label: "OPEX", value: opex, color: "var(--color-opex)" },
          {
            key: "profit",
            label: "Net Profit (as % of Effective)",
            value: profit,
            color: "var(--color-profit)",
            isProfit: true,
          },
        ]
      : [
          { key: "manufacturing", label: "Manufacturing Cost", value: manufacturing, color: "var(--color-manufacturing)" },
          { key: "packaging", label: "Packaging Cost", value: packaging, color: "var(--color-packaging)" },
          { key: "marketing", label: "Marketing Cost", value: marketing, color: "var(--color-marketing)" },
          { key: "opex", label: "OPEX", value: opex, color: "var(--color-opex)" },
          { key: "discounts", label: "Discount Impact", value: discountImpact, color: "var(--color-discount)" },
          { key: "returns", label: "Returns Impact", value: returnsImpact, color: "var(--color-returns)" },
          {
            key: "profit",
            label: "Net Profit (as % of Gross)",
            value: profit,
            color: "var(--color-profit)",
            isProfit: true,
          },
        ];
    const normalized = segments.map((segment) => ({
      ...segment,
      pct: baseRevenue > 0 ? segment.value / baseRevenue : 0,
    }));
    return { baseRevenue, segments: normalized };
  }, [
    grossRevenue,
    effectiveRevenue,
    economicsBasis,
    inputs,
    productSummary,
    productMap,
    marketingCalc,
    opexTotal,
    discountsImpact,
  ]);

  const sizeRowsAdjusted = React.useMemo(() => {
    if (!sizeRows.length || !productSummary.length) return [];
    const sizeTotalsByProduct = sizeRows.reduce((acc, row) => {
      acc[row.product_id] = (acc[row.product_id] || 0) + Number(row.qty || 0);
      return acc;
    }, {});

    return sizeRows.map((row) => {
      const productTotals = adjustedProductTotals[row.product_id];
      if (!productTotals) return row;
      const sizeQty = Number(row.qty || 0);
      const denomQty =
        productTotals.campaign_qty > 0 ? productTotals.campaign_qty : sizeTotalsByProduct[row.product_id] || 0;
      if (denomQty <= 0 || sizeQty <= 0) return row;
      const share = sizeQty / denomQty;
      const totalCost = productTotals.total_cost * share;
      const factoryCost = (productTotals.factory_cost || 0) * share;
      const effectiveRevenue = Number(row.effective_revenue || 0);
      return {
        ...row,
        factory_cost: factoryCost,
        total_cost: totalCost,
        net_profit: effectiveRevenue - totalCost,
      };
    });
  }, [sizeRows, productSummary, adjustedProductTotals]);

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
      acc[key].totalCost += Number(row.totalCost ?? 0);
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
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Total units planned across all products for the campaign.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Total units = Σ product quantities</div>
                  <div className="space-y-0.5 text-muted">
                    {productLines.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <span>{p.qty}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">Total: {productUnits} units</div>
                </div>
              </div>
            }
          />
          <Card
            title="Gross Revenue"
            value={fmt(grossRevenue, currency)}
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Sales before discounts and returns.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Gross revenue = Σ product gross revenue</div>
                  <div className="space-y-0.5 text-muted">
                    {productLines.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <span>{fmt(p.gross, currency)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">{fmt(grossRevenue, currency)}</div>
                </div>
              </div>
            }
          />
          <Card
            title="Effective Revenue (after discounts & returns)"
            value={fmt(effectiveRevenue, currency)}
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Sales after discounts and returns.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Effective revenue = Σ product effective revenue</div>
                  <div className="space-y-0.5 text-muted">
                    {productLines.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <span>{fmt(p.effective, currency)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">{fmt(effectiveRevenue, currency)}</div>
                </div>
              </div>
            }
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
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Share of gross revenue lost to discounts and returns.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Leakage = (Gross − Effective) ÷ Gross</div>
                  <div className="space-y-0.5 text-muted">
                    <div>Gross revenue: {fmt(grossRevenue, currency)}</div>
                    <div>Effective revenue: {fmt(effectiveRevenue, currency)}</div>
                    <div>Leakage value: {fmt(revenueLeakageValue, currency)}</div>
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">
                    {fmt(revenueLeakageValue, currency)} ÷ {fmt(grossRevenue, currency)} ={" "}
                    {revenueLeakagePct?.toFixed(1)}%
                  </div>
                </div>
              </div>
            }
          />
          <Card
            title="Total Cost (incl. Marketing, OPEX, Packaging)"
            value={fmt(totalCost, currency)}
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>All costs including factory, marketing, and OPEX.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Total cost = Manufacturing + Packaging + Campaign marketing + OPEX</div>
                  <div className="space-y-0.5 text-muted">
                    <div>Manufacturing + Packaging (all products): {fmt(factoryPackagingTotal, currency)}</div>
                    <div>Campaign marketing total: {fmt(mCampaign, currency)}</div>
                    <div>OPEX total (all linked items): {fmt(baseOpex, currency)}</div>
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">{fmt(totalCost, currency)}</div>
                </div>
              </div>
            }
          />
          <Card
            title="Net Profit"
            value={fmt(netProfit, currency)}
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Effective revenue minus total cost.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Net profit = Effective revenue − Total cost</div>
                  <div className="space-y-0.5 text-muted">
                    <div>Effective revenue: {fmt(effectiveRevenue, currency)}</div>
                    <div>Total cost: {fmt(totalCost, currency)}</div>
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">
                    {fmt(effectiveRevenue, currency)} − {fmt(totalCost, currency)} = {fmt(netProfit, currency)}
                  </div>
                </div>
              </div>
            }
          />
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
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Net profit as a share of effective revenue.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Net margin = Net profit ÷ Effective revenue</div>
                  <div className="space-y-0.5 text-muted">
                    <div>Net profit: {fmt(netProfit, currency)}</div>
                    <div>Effective revenue: {fmt(effectiveRevenue, currency)}</div>
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">
                    {fmt(netProfit, currency)} ÷ {fmt(effectiveRevenue, currency)} = {netMarginValue?.toFixed(1)}%
                  </div>
                </div>
              </div>
            }
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
            help={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Effective revenue earned per 1 unit of marketing cost.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Efficiency = Effective revenue ÷ Marketing cost</div>
                  <div className="space-y-0.5 text-muted">
                    <div>Effective revenue: {fmt(effectiveRevenue, currency)}</div>
                    <div>Marketing cost: {fmt(marketingCalc.marketingTotalFinal, currency)}</div>
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">
                    {fmt(effectiveRevenue, currency)} ÷ {fmt(marketingCalc.marketingTotalFinal, currency)} ={" "}
                    {marketingEfficiencyRatio?.toFixed(2)}x
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-lg font-semibold text-text">Marketing & OPEX</div>
          <InfoTooltip
            text={
              <div className="space-y-1">
                <div className="font-semibold text-text">Definition</div>
                <div>Campaign-level marketing spend and linked OPEX totals.</div>
                <div className="pt-1 border-t border-border/60">
                  <div className="font-semibold text-text">Calculation</div>
                  <div>Marketing (campaign) = sum of campaign marketing inputs</div>
                  <div>OPEX (linked) = sum of linked OPEX items</div>
                  <div>Total Marketing & OPEX = Marketing + OPEX</div>
                  <div className="space-y-0.5 text-muted">
                    <div>Marketing total: {fmt(marketingCalc.marketingTotalFinal, currency)}</div>
                    {opexLines.length ? (
                      <div className="pt-1">
                        {opexLines.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>{item.name}</span>
                            <span>{fmt(item.cost, currency)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>OPEX total: {fmt(opexTotal, currency)}</div>
                    )}
                  </div>
                  <div className="text-text pt-1 border-t border-border/60">
                    {fmt(marketingCalc.marketingTotalFinal, currency)} + {fmt(opexTotal, currency)} ={" "}
                    {fmt(marketingCalc.marketingTotalFinal + opexTotal, currency)}
                  </div>
                </div>
              </div>
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Marketing Cost (campaign)" value={fmt(marketingCalc.marketingTotalFinal, currency)} />
          <Card title="OPEX (linked)" value={fmt(opexTotal, currency)} />
          <Card title="Total Marketing & OPEX costs" value={fmt(marketingCalc.marketingTotalFinal + opexTotal, currency)} />
        </div>
      </div>

      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-text">Forecast Output</div>
            <InfoTooltip
              text={
                <div className="space-y-1">
                  <div>
                    Shows expected performance after discounts, returns, and product marketing spend, but before business
                    overhead (OPEX).
                  </div>
                  <div>
                    Use this view to understand how profitable each product is after running the campaign, but before fixed
                    operating costs.
                  </div>
                </div>
              }
            />
          </div>
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
                <span className="font-medium text-text">Product-Level Cost</span> Manufacturing, packaging, and product
                marketing only. Excludes OPEX and campaign-level fixed costs.
              </div>
              <div>
                <span className="font-medium text-text">Contribution Profit</span> Effective Revenue minus Product-Level
                Cost.
              </div>
              <div>
                <span className="font-medium text-text">Contribution Margin</span> Contribution Profit as a percentage of
                Effective Revenue.
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
                <th className="py-2 pr-3">Product-Level Cost</th>
                <th className="py-2 pr-3">Contribution Profit</th>
                <th className="py-2 pr-3">Contribution Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayRows.map((row) => {
                const effRev = Number(row.effective_revenue ?? row.gross_revenue ?? 0);
                const cost = Number(row.totalCost ?? 0);
                const profit = Number(row.netProfit ?? 0);
                const margin = row.netMargin ?? (effRev ? (profit / effRev) * 100 : null);
                return (
                  <tr key={`${row.month}-${row.product_id}`}>
                    <td className="py-2 pr-3 text-muted">{row.month_nice || niceMonth(row.month)}</td>
                    <td className="py-2 pr-3">{row.product_name}</td>
                    <td className="py-2 pr-3">{Math.round(row.qty)}</td>
                    <td className="py-2 pr-3">{fmt(row.gross_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(row.effective_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(profit, currency)}</td>
                    <td className="py-2 pr-3">{margin === null ? "--" : pct(margin)}</td>
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
            Gross revenue, effective revenue, and Product-Level Cost comparison
          </div>
          {showForecastChart && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-gross)" }} />
                  <span>Gross Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-effective)" }} />
                  <span>Effective Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-cost-total)" }} />
                  <span>Product-Level Cost</span>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-accent-15)" />
                        <XAxis
                          dataKey="product_name"
                          tick={{ fill: "var(--color-accent-2)", fontSize: 11 }}
                          axisLine={{ stroke: "var(--color-border)" }}
                          tickLine={{ stroke: "var(--color-border)" }}
                          interval={0}
                          tickMargin={8}
                        />
                        <YAxis
                          domain={[0, productBarDomain.max]}
                          ticks={productBarDomain.ticks}
                          tickFormatter={(val) => fmt(val, currency)}
                          tick={{ fill: "var(--color-accent-2)", fontSize: 11 }}
                          axisLine={{ stroke: "var(--color-border)" }}
                          tickLine={{ stroke: "var(--color-border)" }}
                          width={72}
                        />
                    <Tooltip
                      formatter={(val, name) => [fmt(val, currency), name]}
                      contentStyle={{
                        background: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                      }}
                      labelStyle={{ color: "var(--color-text)" }}
                      itemStyle={{ color: "var(--color-text)" }}
                      shared={false}
                      cursor={{ fill: "var(--color-accent-15)" }}
                    />
                    <Bar dataKey="gross" name="Gross Revenue" fill="var(--color-gross)" barSize={26} maxBarSize={28}>
                      <LabelList
                        dataKey="gross"
                        position="top"
                        formatter={(val) => fmt(val, currency)}
                        fill="var(--color-accent)"
                        fontSize={10}
                        offset={28}
                        angle={-90}
                        textAnchor="middle"
                      />
                    </Bar>
                    <Bar dataKey="effective" name="Effective Revenue" fill="var(--color-effective)" barSize={26} maxBarSize={28}>
                      <LabelList
                        dataKey="effective"
                        position="top"
                        formatter={(val) => fmt(val, currency)}
                        fill="var(--color-accent)"
                        fontSize={10}
                        offset={28}
                        angle={-90}
                        textAnchor="middle"
                      />
                    </Bar>
                    <Bar dataKey="totalCost" name="Total Cost" fill="var(--color-cost-total)" barSize={26} maxBarSize={28}>
                      <LabelList
                        dataKey="totalCost"
                        position="top"
                        formatter={(val) => fmt(val, currency)}
                        fill="var(--color-accent)"
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
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-text">Size Breakdown</div>
            <InfoTooltip
              text={
                <div className="space-y-1">
                  <div>Shows pure unit economics by size, using only manufacturing and packaging costs.</div>
                  <div>
                    Marketing spend and business overhead are intentionally excluded so you can see how profitable each
                    product is to make and sell, regardless of campaign activity.
                  </div>
                </div>
              }
            />
          </div>
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
                <span className="font-medium text-text">Revenue</span> Effective revenue after discounts and returns.
              </div>
              <div>
                <span className="font-medium text-text">Gross Profit</span> Revenue minus Factory Cost.
              </div>
              <div>
                <span className="font-medium text-text">Gross Margin</span> Gross Profit as a percentage of Revenue.
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
                <th className="py-2 pr-3">Gross Profit</th>
                <th className="py-2 pr-3">Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sizeRowsFiltered.map((r) => {
                const grossProfit = Number(r.effective_revenue || 0) - Number(r.factory_cost || 0);
                const margin = r.effective_revenue ? (grossProfit / r.effective_revenue) * 100 : 0;
                return (
                  <tr key={`${r.product_id}-${r.size}`}>
                    <td className="py-2 pr-3">{r.product_name}</td>
                    <td className="py-2 pr-3">{r.size}</td>
                    <td className="py-2 pr-3">{r.qty}</td>
                    <td className="py-2 pr-3">{fmt(r.effective_revenue, currency)}</td>
                    <td className="py-2 pr-3">{fmt(r.factory_cost, currency)}</td>
                    <td className="py-2 pr-3">{fmt(grossProfit, currency)}</td>
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
        <div className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold text-text">Unit Economics Waterfall</div>
            <button
              type="button"
              className="text-xs text-muted border border-border/60 rounded-md px-2 py-1 bg-card hover:bg-border/40"
              onClick={() => setShowUnitEconomics((prev) => !prev)}
            >
              {showUnitEconomics ? "Collapse" : "Expand"}
            </button>
          </div>
          {showUnitEconomics && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-cost-total)" }} />
                    <span>Factory Unit Cost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-profit)" }} />
                    <span>Unit Profit</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {unitWaterfallData.map((row) => {
                  const costPct = Math.min(100, Math.max(0, (row.totalCost / (row.revenue || 1)) * 100));
                  const profitPct = Math.max(0, 100 - costPct);
                  return (
                    <div key={row.product_id} className="border border-border/60 rounded-lg p-4 bg-surface space-y-2">
                      <div className="text-sm font-semibold text-text">{row.product_name}</div>
                      <div className="text-[11px] text-muted">
                        100% = Unit Revenue ({fmt(row.revenue, currency)})
                      </div>
                      <div className="h-3 w-full rounded-full bg-border/40 overflow-hidden flex">
                        <div
                          className="h-full"
                          style={{ width: `${costPct}%`, backgroundColor: "var(--color-cost-total)", opacity: 0.8 }}
                          title={`Factory Unit Cost: ${fmt(row.totalCost, currency)}`}
                        />
                        <div
                          className="h-full"
                          style={{ width: `${profitPct}%`, backgroundColor: "var(--color-profit)", opacity: 0.85 }}
                          title={`Unit Profit: ${fmt(row.profit, currency)}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span style={{ color: "var(--color-cost-total)" }}>{costPct.toFixed(1)}% Factory Cost</span>
                        <span style={{ color: "var(--color-profit)" }}>{profitPct.toFixed(1)}% Profit</span>
                      </div>
                    </div>
                  );
                })}
                {!unitWaterfallData.length && (
                  <div className="text-sm text-muted">No unit data available.</div>
                )}
              </div>
            </div>
          )}
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
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold text-text">
              {economicsBasis === "effective" ? "Effective Revenue Economics" : "Gross Revenue Economics"}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Basis</label>
              <div className="flex flex-col items-end gap-1">
                <select
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text"
                  value={economicsBasis}
                  onChange={(e) => setEconomicsBasis(e.target.value)}
                >
                  <option value="gross">Gross Revenue</option>
                  <option value="effective">Effective Revenue</option>
                </select>
                <div className="text-[11px] text-muted">
                  {economicsBasis === "effective" ? "After discounts and returns" : "Before discounts and returns"}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="border border-border/60 rounded-lg p-4 bg-surface space-y-3">
              <div className="text-sm font-semibold text-muted">
                {economicsBasis === "effective"
                  ? "Effective Revenue Allocation (100% of Effective)"
                  : "Gross Revenue Allocation (100% of Gross)"}
              </div>
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
                          <span
                            className={seg.isProfit ? "font-medium" : ""}
                            style={seg.isProfit ? { color: "var(--color-profit)" } : undefined}
                          >
                            {pct(seg.pctDisplay * 100)} ({fmt(seg.value, currency)})
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${seg.pctDisplay * 100}%`,
                              backgroundColor: seg.isProfit ? "var(--color-profit)" : seg.color,
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
                    <div className="text-center" style={{ width: `${profitPct * 100}%`, color: "var(--color-profit)" }}>
                      {pct(profitPct * 100)} <span className="text-muted">(Profit)</span>
                    </div>
                  </div>
                  <div className="flex h-2 rounded-full bg-border/40 overflow-hidden">
                    <div className="h-full" style={{ width: `${costPct * 100}%`, backgroundColor: "var(--color-accent-35)", opacity: 0.8 }} />
                    <div className="h-full" style={{ width: `${profitPct * 100}%`, backgroundColor: "var(--color-profit)", opacity: 0.85 }} />
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







