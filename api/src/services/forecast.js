const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDate = (d) => (d instanceof Date ? d : new Date(d));

export const monthRange = (start, end) => {
  const s = toDate(start);
  const e = toDate(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];

  const startDate = s <= e ? s : e;
  const endDate = s <= e ? e : s;

  const months = [];
  let y = startDate.getFullYear();
  let m = startDate.getMonth() + 1;

  while (y < endDate.getFullYear() || (y === endDate.getFullYear() && m <= endDate.getMonth() + 1)) {
    months.push(`${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return months;
};

export const monthLabelToNice = (label) => {
  const [y, m] = label.split('-').map((v) => Number(v));
  if (!y || !m) return label;
  return `${MONTH_ABBR[m - 1]} ${y}`;
};

export const buildDistributionWeights = (months, mode = 'Uniform', customWeights) => {
  const n = months.length;
  if (n === 0) return {};

  let w;
  if (mode === 'Uniform') {
    w = Array(n).fill(1);
  } else if (mode === 'Front-loaded') {
    w = Array.from({ length: n }, (_, i) => n - i);
  } else if (mode === 'Back-loaded') {
    w = Array.from({ length: n }, (_, i) => i + 1);
  } else if (mode === 'Custom') {
    if (!customWeights) {
      w = Array(n).fill(1);
    } else {
      w = months.map((m) => {
        const val = Number(customWeights[m] ?? 0);
        return Number.isNaN(val) ? 0 : Math.max(0, val);
      });
      if (w.every((val) => val === 0)) w = Array(n).fill(1);
    }
  } else {
    w = Array(n).fill(1);
  }

  const total = w.reduce((sum, val) => sum + val, 0) || 1;
  return months.reduce((acc, m, idx) => {
    acc[m] = w[idx] / total;
    return acc;
  }, {});
};

export const distributeQuantity = (totalQty, weights) =>
  Object.entries(weights).reduce((acc, [month, weight]) => {
    acc[month] = totalQty * weight;
    return acc;
  }, {});

export const effectivePrice = (product) => {
  const afterDiscount = product.price_bdt * (1 - (product.discount_rate || 0));
  return afterDiscount * (1 - (product.return_rate || 0));
};

export const totalUnitCost = (product) =>
  (product.manufacturing_cost_bdt || 0) +
  (product.packaging_cost_bdt || 0) +
  (product.shipping_cost_bdt || 0) +
  (product.marketing_cost_bdt || 0);

const totalUnitCostWithOverride = (product) => {
  if (
    product.cost_override_total_bdt !== undefined &&
    product.cost_override_total_bdt !== null
  ) {
    const val = Number(product.cost_override_total_bdt);
    if (!Number.isNaN(val)) return val;
  }
  return totalUnitCost(product);
};

export const unitNetProfit = (product) => effectivePrice(product) - totalUnitCost(product);

const revenueForProductMonth = (product, qty) => {
  const ep = effectivePrice(product);
  const tuc = totalUnitCostWithOverride(product);
  const unp = ep - tuc;

  return {
    gross_revenue: product.price_bdt * qty,
    effective_revenue: ep * qty,
    total_cost: tuc * qty,
    net_profit: unp * qty,
  };
};

export const buildCampaignForecast = ({
  products,
  quantities,
  startDate,
  endDate,
  distributionMode = 'Uniform',
  customMonthWeights,
  perProductMonthWeights,
  sizeBreakdown,
}) => {
  const months = monthRange(startDate, endDate);
  const baseWeights = buildDistributionWeights(months, distributionMode, customMonthWeights);

  const prodMap = products.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const monthlyRows = [];

  Object.entries(quantities).forEach(([pid, totalQty]) => {
    const qtyNum = Number(totalQty || 0);
    if (!prodMap[pid] || qtyNum <= 0) return;

    let weightsForPid = baseWeights;
    if (
      distributionMode === 'Custom' &&
      perProductMonthWeights &&
      perProductMonthWeights[pid]
    ) {
      weightsForPid = buildDistributionWeights(months, 'Custom', perProductMonthWeights[pid]);
    }

    const monthQtys = distributeQuantity(qtyNum, weightsForPid);
    const product = prodMap[pid];

    Object.entries(monthQtys).forEach(([month, qty]) => {
      const qVal = Number(qty || 0);
      if (qVal <= 0) return;
      const econ = revenueForProductMonth(product, qVal);
      monthlyRows.push({
        month,
        month_nice: monthLabelToNice(month),
        product_id: pid,
        product_name: product.name,
        category: product.category,
        qty: qVal,
        price_bdt: product.price_bdt,
        effective_price: effectivePrice(product),
        gross_revenue: econ.gross_revenue,
        effective_revenue: econ.effective_revenue,
        total_cost: econ.total_cost,
        net_profit: econ.net_profit,
      });
    });
  });

  const productSummaryMap = {};
  monthlyRows.forEach((row) => {
    const key = row.product_id;
    if (!productSummaryMap[key]) {
      productSummaryMap[key] = {
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        campaign_qty: 0,
        gross_revenue: 0,
        effective_revenue: 0,
        total_cost: 0,
        net_profit: 0,
      };
    }
    const agg = productSummaryMap[key];
    agg.campaign_qty += row.qty;
    agg.gross_revenue += row.gross_revenue;
    agg.effective_revenue += row.effective_revenue;
    agg.total_cost += row.total_cost;
    agg.net_profit += row.net_profit;
  });

  const product_summary = Object.values(productSummaryMap).map((p) => {
    const grossMargin =
      p.gross_revenue === 0 ? 0 : ((p.gross_revenue - p.total_cost) / p.gross_revenue) * 100;
    const netMargin =
      p.effective_revenue === 0 ? 0 : (p.net_profit / p.effective_revenue) * 100;
    return {
      ...p,
      'gross_margin_%': grossMargin,
      'net_margin_%': netMargin,
    };
  });

  const totals = monthlyRows.reduce(
    (acc, row) => {
      acc.campaign_qty += row.qty;
      acc.gross_revenue += row.gross_revenue;
      acc.effective_revenue += row.effective_revenue;
      acc.total_cost += row.total_cost;
      acc.net_profit += row.net_profit;
      return acc;
    },
    {
      campaign_qty: 0,
      gross_revenue: 0,
      effective_revenue: 0,
      total_cost: 0,
      net_profit: 0,
    },
  );

  const sizeRows = [];
  if (sizeBreakdown) {
    Object.entries(sizeBreakdown).forEach(([pid, sb]) => {
      if (!productSummaryMap[pid]) return;
      const productTotals = productSummaryMap[pid];
      const sizes = sb || {};
      const totalSizeQty = Object.values(sizes).reduce((sum, val) => sum + Number(val || 0), 0);
      const productQty = Number(productTotals.campaign_qty || 0);
      const denomQty = productQty > 0 ? productQty : totalSizeQty;
      if (denomQty <= 0) return;
      Object.entries(sizes).forEach(([size, sqty]) => {
        const qtyVal = Number(sqty || 0);
        if (qtyVal <= 0) return;
        const share = qtyVal / denomQty;
        const effectiveRevenue = productTotals.effective_revenue * share;
        const totalCost = productTotals.total_cost * share;
        sizeRows.push({
          product_id: pid,
          product_name: productTotals.product_name,
          size,
          qty: qtyVal,
          gross_revenue: productTotals.gross_revenue * share,
          effective_revenue: effectiveRevenue,
          total_cost: totalCost,
          net_profit: effectiveRevenue - totalCost,
        });
      });
    });
  }

  return {
    monthly: monthlyRows,
    product_summary,
    size_breakdown: sizeRows,
    totals,
  };
};
