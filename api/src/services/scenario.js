import { buildCampaignForecast, effectivePrice, totalUnitCost, unitNetProfit, monthRange, monthLabelToNice } from './forecast.js';

export const applyProductOverrides = (products = [], overrides = []) => {
  const ovMap = overrides.reduce((acc, o) => {
    acc[o.product_id] = o;
    return acc;
  }, {});

  return products.map((p) => {
    const o = ovMap[p.id] || {};
    const price_bdt = o.price_override !== undefined && o.price_override !== null ? Number(o.price_override) : p.price_bdt;
    const discount_rate = o.discount_override !== undefined && o.discount_override !== null ? Number(o.discount_override) / 100 : p.discount_rate;
    const return_rate = o.return_rate_override !== undefined && o.return_rate_override !== null ? Number(o.return_rate_override) / 100 : p.return_rate;
    const cost_override_total_bdt = o.cost_override !== undefined && o.cost_override !== null ? Number(o.cost_override) : null;

    return {
      ...p,
      price_bdt,
      discount_rate,
      return_rate,
      cost_override_total_bdt,
    };
  });
};

export const applyQuantityOverrides = (baseQuantities = {}, overrides = []) => {
  const out = { ...baseQuantities };
  overrides.forEach((o) => {
    if (o.qty_override !== undefined && o.qty_override !== null) {
      out[o.product_id] = Number(o.qty_override);
    }
  });
  return out;
};

export const totalUnitCostWithOverride = (product) => {
  if (product.cost_override_total_bdt !== null && product.cost_override_total_bdt !== undefined) {
    return Number(product.cost_override_total_bdt);
  }
  return totalUnitCost(product);
};

export const buildScenarioForecast = ({
  products,
  campaign,
  scenario_product_overrides,
  scenario_opex_overrides,
  distributionModeOverride,
  customWeightsOverride,
}) => {
  const months = monthRange(campaign.start_date, campaign.end_date);

  const prodWithOverrides = applyProductOverrides(products, scenario_product_overrides || []);

  const baseQuantities = campaign._quantities || {};
  const quantities = applyQuantityOverrides(baseQuantities, scenario_product_overrides || []);

  // weights
  let weights;
  if ((distributionModeOverride || campaign.distribution_mode) === 'Custom') {
    weights = customWeightsOverride || campaign._month_weights || {};
  } else {
    weights = undefined; // handled by buildCampaignForecast via mode
  }

  // Use existing campaign per-product weights if mode is Custom and no override provided
  const perProductWeights =
    (distributionModeOverride || campaign.distribution_mode) === 'Custom'
      ? campaign._product_month_weights || {}
      : {};

  // Build forecast using forecast service but swap cost calc for overrides
  const forecast = buildCampaignForecast({
    products: prodWithOverrides,
    quantities,
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    distributionMode: distributionModeOverride || campaign.distribution_mode || 'Uniform',
    customMonthWeights: weights,
    perProductMonthWeights: perProductWeights,
    sizeBreakdown: campaign._size_breakdown || {},
  });

  // Apply OPEX overrides: replace cost if provided
  const ovMap = (scenario_opex_overrides || []).reduce((acc, o) => {
    acc[o.opex_item_id] = o;
    return acc;
  }, {});

  // campaign._attached_opex contains linked items and costs
  const opexItems = (campaign._attached_opex || []).map((o) => {
    if (o.id in ovMap && ovMap[o.id].cost_override !== undefined && ovMap[o.id].cost_override !== null) {
      return { ...o, cost_bdt: Number(ovMap[o.id].cost_override) };
    }
    return o;
  });

  // Simplified OPEX total (no month window in overrides) — we mirror scenario_engine by summing across months
  // For scenario results we only need totals, not monthly mix.
  // Assume campaign months count; recurring per month vs one-time handled by start/end fields.
  let opex_total = 0;
  opexItems.forEach((it) => {
    const start = it.start_month;
    const end = it.end_month || months[months.length - 1];
    if (it.is_one_time) {
      if (start && months.includes(start)) opex_total += Number(it.cost_bdt || 0);
    } else {
      months.forEach((m) => {
        if (start && start <= m && m <= end) {
          opex_total += Number(it.cost_bdt || 0);
        }
      });
    }
  });

  const totals = {
    campaign_qty: forecast.totals.campaign_qty,
    gross_revenue: forecast.totals.gross_revenue,
    effective_revenue: forecast.totals.effective_revenue,
    total_cost: forecast.totals.total_cost,
    net_profit_variable: forecast.totals.net_profit,
    opex_total,
    net_profit_after_opex: forecast.totals.net_profit - opex_total,
  };

  return {
    monthly: forecast.monthly.map((row) => ({
      ...row,
      effective_price_bdt: row.effective_price,
    })),
    product_summary: forecast.product_summary,
    totals,
  };
};
