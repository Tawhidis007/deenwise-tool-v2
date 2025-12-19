import { monthRange, monthLabelToNice } from './forecast.js';

export const expandOpexForCampaign = (campaignStart, campaignEnd, opexItems = []) => {
  const campMonths = monthRange(campaignStart, campaignEnd);
  if (!campMonths.length) return [];

  const rows = [];
  opexItems.forEach((item) => {
    const startMonth = item.start_month;
    const endMonth = item.end_month || '9999-12';
    if (!startMonth) return;

    campMonths.forEach((m) => {
      if (!(startMonth <= m && m <= endMonth)) return;
      if (item.is_one_time && m !== startMonth) return;

      rows.push({
        month: m,
        month_nice: monthLabelToNice(m),
        opex_id: item.id,
        name: item.name,
        category: item.category,
        cost_bdt: Number(item.cost_bdt || 0),
        is_one_time: Boolean(item.is_one_time),
        notes: item.notes || '',
      });
    });
  });

  return rows;
};

export const opexMonthTable = (rows = []) => {
  const map = new Map();
  rows.forEach((r) => {
    const cost = Number(r.cost_bdt || 0);
    if (Number.isNaN(cost)) return;
    map.set(r.month, (map.get(r.month) || 0) + cost);
  });

  return Array.from(map.entries())
    .map(([month, cost]) => ({
      month,
      month_nice: monthLabelToNice(month),
      opex_cost_bdt: cost,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};
