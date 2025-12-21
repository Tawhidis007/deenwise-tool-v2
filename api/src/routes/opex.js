import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middlewares/auth.js';
import { buildCampaignForecast } from '../services/forecast.js';
import { expandOpexForCampaign, opexMonthTable } from '../services/opex.js';

const router = Router();
const supabase = getSupabase();

const parseBool = (val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  const normalized = String(val).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
};

const nowIso = () => new Date().toISOString();

const isObject = (val) => val && typeof val === 'object' && !Array.isArray(val);

const validateOpex = (body, { partial = false } = {}) => {
  const errors = [];
  const required = ['name', 'category', 'cost_bdt', 'start_month'];
  if (!partial) {
    required.forEach((field) => {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  if (body.cost_bdt !== undefined && body.cost_bdt !== null) {
    const num = Number(body.cost_bdt);
    if (Number.isNaN(num)) errors.push('cost_bdt must be a number');
    else if (num < 0) errors.push('cost_bdt cannot be negative');
  }

  return errors;
};

const OPEX_FIELDS = [
  'id',
  'name',
  'category',
  'cost_bdt',
  'start_month',
  'end_month',
  'is_one_time',
  'notes',
];

const pickOpex = (row = {}) =>
  OPEX_FIELDS.reduce((acc, key) => {
    if (key in row) acc[key] = row[key];
    return acc;
  }, {});

// GET /opex
router.get('/opex', requireAuth, async (req, res, next) => {
  try {
    let { data, error } = await supabase
      .from('opex_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return res.json({ items: (data || []).map(pickOpex) });
  } catch (err) {
    return next(err);
  }
});

// POST /opex
router.post('/opex', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validateOpex(body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const payload = {
      name: body.name,
      category: body.category,
      cost_bdt: Number(body.cost_bdt),
      start_month: body.start_month,
      end_month: body.end_month || null,
      is_one_time: body.is_one_time ? true : false,
      notes: body.notes || '',
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const { data, error } = await supabase.from('opex_items').insert(payload).select('*').single();
    if (error) throw error;

    return res.status(201).json(pickOpex(data));
  } catch (err) {
    return next(err);
  }
});

// PUT /opex/:id
router.put('/opex/:id', requireAuth, async (req, res, next) => {
  try {
    const opexId = req.params.id;
    const body = req.body || {};
    const errors = validateOpex(body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const { data: existing, error: findErr } = await supabase
      .from('opex_items')
      .select('*')
      .eq('id', opexId)
      .single();
    if (findErr || !existing) return res.status(404).json({ error: 'Not found' });

    const payload = { updated_at: nowIso() };
    ['name', 'category', 'start_month', 'end_month', 'notes'].forEach((field) => {
      if (field in body) payload[field] = body[field];
    });
    if (body.cost_bdt !== undefined) payload.cost_bdt = Number(body.cost_bdt);
    if (body.is_one_time !== undefined) payload.is_one_time = Boolean(body.is_one_time);
    if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);

    const { data, error } = await supabase
      .from('opex_items')
      .update(payload)
      .eq('id', opexId)
      .select('*')
      .single();
    if (error) throw error;

    return res.json(pickOpex(data));
  } catch (err) {
    return next(err);
  }
});

// DELETE /opex/:id
router.delete('/opex/:id', requireAuth, async (req, res, next) => {
  try {
    const opexId = req.params.id;
    const { data: existing, error: findErr } = await supabase
      .from('opex_items')
      .select('id')
      .eq('id', opexId)
      .single();
    if (findErr || !existing) return res.status(404).json({ error: 'Not found' });

    const { error } = await supabase.from('opex_items').delete().eq('id', opexId);
    if (error) throw error;

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/opex
router.put('/campaigns/:id/opex', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { opex_ids } = req.body || {};
    if (!Array.isArray(opex_ids)) {
      return res.status(400).json({ error: 'Invalid opex_ids' });
    }

    const { error: delErr } = await supabase
      .from('campaign_opex')
      .delete()
      .eq('campaign_id', campaignId);
    if (delErr) throw delErr;

    if (opex_ids.length) {
      const payload = opex_ids.map((oid) => ({ campaign_id: campaignId, opex_id: oid }));
      const { error: insErr } = await supabase.from('campaign_opex').insert(payload);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// GET /campaigns/:id/opex
router.get('/campaigns/:id/opex', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { data: links, error } = await supabase
      .from('campaign_opex')
      .select('opex_id')
      .eq('campaign_id', campaignId);
    if (error) throw error;
    const ids = (links || []).map((r) => r.opex_id);

    let items = [];
    if (ids.length) {
      const { data: opexItems, error: itemsErr } = await supabase
        .from('opex_items')
        .select('*')
        .in('id', ids);
      if (itemsErr) throw itemsErr;
      items = (opexItems || []).map(pickOpex);
    }

    return res.json({ ids, items });
  } catch (err) {
    return next(err);
  }
});

// GET /campaigns/:id/profitability
router.get('/campaigns/:id/profitability', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (cErr || !campaign) return res.status(404).json({ error: 'Not found' });

    // Quantities
    const { data: qRows, error: qErr } = await supabase
      .from('campaign_quantities')
      .select('*')
      .eq('campaign_id', campaignId);
    if (qErr) throw qErr;
    const quantities = {};
    (qRows || []).forEach((r) => {
      const qtyVal = r.total_qty ?? r.qty ?? 0;
      quantities[r.product_id] = Number(qtyVal || 0);
    });

    // Month weights
    const { data: mwRows, error: mwErr } = await supabase
      .from('campaign_month_weights')
      .select('*')
      .eq('campaign_id', campaignId);
    if (mwErr) throw mwErr;
    const month_weights = {};
    const product_month_weights = {};
    (mwRows || []).forEach((r) => {
      const weight = Number(r.weight || 0);
      if (r.product_id) {
        product_month_weights[r.product_id] = product_month_weights[r.product_id] || {};
        product_month_weights[r.product_id][r.month_label] = weight;
      } else {
        month_weights[r.month_label] = weight;
      }
    });

    // Size breakdown
    const { data: sbRows, error: sbErr } = await supabase
      .from('campaign_size_breakdown')
      .select('*')
      .eq('campaign_id', campaignId);
    if (sbErr) throw sbErr;
    const size_breakdown = {};
    (sbRows || []).forEach((r) => {
      if (!size_breakdown[r.product_id]) size_breakdown[r.product_id] = {};
      size_breakdown[r.product_id][r.size] = Number(r.qty || 0);
    });

    // Products
    const { data: prodRows, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);
    if (pErr) throw pErr;

    const forecast = buildCampaignForecast({
      products: prodRows || [],
      quantities,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      distributionMode: campaign.distribution_mode || 'Uniform',
      customMonthWeights: Object.keys(month_weights).length ? month_weights : undefined,
      perProductMonthWeights: product_month_weights,
      sizeBreakdown: size_breakdown,
    });

    // Revenue monthly aggregated
    const revenueMap = new Map();
    (forecast.monthly || []).forEach((row) => {
      const key = row.month;
      if (!revenueMap.has(key)) {
        revenueMap.set(key, {
          month: row.month,
          month_nice: row.month_nice,
          qty: 0,
          gross_revenue_bdt: 0,
          effective_revenue_bdt: 0,
          variable_cost_bdt: 0,
          net_profit_variable_bdt: 0,
        });
      }
      const agg = revenueMap.get(key);
      agg.qty += row.qty;
      agg.gross_revenue_bdt += row.gross_revenue;
      agg.effective_revenue_bdt += row.effective_revenue;
      agg.variable_cost_bdt += row.total_cost;
      agg.net_profit_variable_bdt += row.net_profit;
    });

    // OPEX links and items
    const { data: linkRows, error: linkErr } = await supabase
      .from('campaign_opex')
      .select('*')
      .eq('campaign_id', campaignId);
    if (linkErr) throw linkErr;
    const opexIds = (linkRows || []).map((r) => r.opex_id);

    let opexItems = [];
    if (opexIds.length) {
      const { data: oRows, error: oErr } = await supabase
        .from('opex_items')
        .select('*')
        .in('id', opexIds);
      if (oErr) throw oErr;
      opexItems = oRows || [];
    }

    const opexExpanded = expandOpexForCampaign(
      campaign.start_date,
      campaign.end_date,
      opexItems,
    );
    const opexMonthly = opexMonthTable(opexExpanded);

    // Combine months
    const monthsSet = new Set();
    revenueMap.forEach((_, key) => monthsSet.add(key));
    opexMonthly.forEach((r) => monthsSet.add(r.month));

    const monthsSorted = Array.from(monthsSet).sort();
    const monthly = monthsSorted.map((m) => {
      const rev = revenueMap.get(m) || {
        month: m,
        month_nice: opexMonthly.find((o) => o.month === m)?.month_nice || m,
        qty: 0,
        gross_revenue_bdt: 0,
        effective_revenue_bdt: 0,
        variable_cost_bdt: 0,
        net_profit_variable_bdt: 0,
      };
      const opexRow = opexMonthly.find((o) => o.month === m);
      const opex_cost_bdt = opexRow ? opexRow.opex_cost_bdt : 0;
      return {
        ...rev,
        opex_cost_bdt,
        net_profit_after_opex_bdt: rev.net_profit_variable_bdt - opex_cost_bdt,
      };
    });

    // Totals
    const totals = monthly.reduce(
      (acc, row) => {
        acc.campaign_qty += row.qty;
        acc.gross_revenue += row.gross_revenue_bdt;
        acc.effective_revenue += row.effective_revenue_bdt;
        acc.net_profit_variable += row.net_profit_variable_bdt;
        acc.total_opex += row.opex_cost_bdt;
        acc.net_profit_after_opex += row.net_profit_after_opex_bdt;
        return acc;
      },
      {
        campaign_qty: 0,
        gross_revenue: 0,
        effective_revenue: 0,
        net_profit_variable: 0,
        total_opex: 0,
        net_profit_after_opex: 0,
      },
    );

    // OPEX by category
    const opex_by_category_map = new Map();
    opexExpanded.forEach((r) => {
      const cost = Number(r.cost_bdt || 0);
      if (Number.isNaN(cost)) return;
      opex_by_category_map.set(r.category, (opex_by_category_map.get(r.category) || 0) + cost);
    });
    const opex_by_category = Array.from(opex_by_category_map.entries()).map(([category, cost]) => ({
      category,
      cost_bdt: cost,
    }));

    return res.json({
      monthly,
      totals,
      opex_by_category,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
