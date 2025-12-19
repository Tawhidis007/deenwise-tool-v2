import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middlewares/auth.js';
import { buildScenarioForecast } from '../services/scenario.js';

const router = Router();
const supabase = getSupabase();

const SCENARIO_FIELDS = ['id', 'name', 'description', 'base_campaign_id', 'created_at', 'updated_at'];
const pickScenario = (row = {}) =>
  SCENARIO_FIELDS.reduce((acc, key) => {
    if (key in row) acc[key] = row[key];
    return acc;
  }, {});

const nowIso = () => new Date().toISOString();
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

const parseCustomWeights = (val) => {
  if (!val) return undefined;
  if (isObject(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return isObject(parsed) ? parsed : undefined;
  } catch (_err) {
    return undefined;
  }
};

// GET /scenarios
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ items: (data || []).map(pickScenario) });
  } catch (err) {
    return next(err);
  }
});

// POST /scenarios
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'Missing required field: name' });

    const payload = {
      name: body.name,
      description: body.description || '',
      base_campaign_id: body.base_campaign_id || null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const { data, error } = await supabase.from('scenarios').insert(payload).select('*').single();
    if (error) throw error;
    return res.status(201).json(pickScenario(data));
  } catch (err) {
    return next(err);
  }
});

// PUT /scenarios/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const body = req.body || {};

    const { data: existing, error: findErr } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();
    if (findErr || !existing) return res.status(404).json({ error: 'Not found' });

    const payload = { updated_at: nowIso() };
    ['name', 'description', 'base_campaign_id'].forEach((field) => {
      if (field in body) payload[field] = body[field];
    });

    const { data, error } = await supabase
      .from('scenarios')
      .update(payload)
      .eq('id', scenarioId)
      .select('*')
      .single();
    if (error) throw error;

    return res.json(pickScenario(data));
  } catch (err) {
    return next(err);
  }
});

// DELETE /scenarios/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const { data: existing, error: findErr } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', scenarioId)
      .single();
    if (findErr || !existing) return res.status(404).json({ error: 'Not found' });

    const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId);
    if (error) throw error;

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PUT /scenarios/:id/campaign
router.put('/:id/campaign', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const { campaign_id } = req.body || {};
    if (!campaign_id) return res.status(400).json({ error: 'Missing campaign_id' });

    // ensure scenario exists
    const { data: existing, error: findErr } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', scenarioId)
      .single();
    if (findErr || !existing) return res.status(404).json({ error: 'Not found' });

    // delete old links
    const { error: delErr } = await supabase
      .from('scenario_campaign_links')
      .delete()
      .eq('scenario_id', scenarioId);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase
      .from('scenario_campaign_links')
      .insert({ scenario_id: scenarioId, campaign_id });
    if (insErr) throw insErr;

    return res.json({ linked: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /scenarios/:id/products
router.put('/:id/products', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const rows = Array.isArray(req.body) ? req.body : [];

    // replace overrides
    const { error: delErr } = await supabase
      .from('scenario_products')
      .delete()
      .eq('scenario_id', scenarioId);
    if (delErr) throw delErr;

    if (rows.length) {
      const payload = rows.map((r) => ({
        scenario_id: scenarioId,
        product_id: r.product_id,
        price_override: r.price_override ?? null,
        discount_override: r.discount_override ?? null,
        return_rate_override: r.return_rate_override ?? null,
        cost_override: r.cost_override ?? null,
        qty_override: r.qty_override ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }));
      const { error: insErr } = await supabase.from('scenario_products').insert(payload);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /scenarios/:id/opex
router.put('/:id/opex', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const rows = Array.isArray(req.body) ? req.body : [];

    const { error: delErr } = await supabase
      .from('scenario_opex')
      .delete()
      .eq('scenario_id', scenarioId);
    if (delErr) throw delErr;

    if (rows.length) {
      const payload = rows.map((r) => ({
        scenario_id: scenarioId,
        opex_item_id: r.opex_item_id,
        cost_override: r.cost_override ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }));
      const { error: insErr } = await supabase.from('scenario_opex').insert(payload);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /scenarios/:id/fx
router.put('/:id/fx', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const rows = Array.isArray(req.body) ? req.body : [];

    const { error: delErr } = await supabase.from('scenario_fx').delete().eq('scenario_id', scenarioId);
    if (delErr) throw delErr;

    if (rows.length) {
      const payload = rows.map((r) => ({
        scenario_id: scenarioId,
        currency: r.currency,
        rate: Number(r.rate),
        created_at: nowIso(),
        updated_at: nowIso(),
      }));
      const { error: insErr } = await supabase.from('scenario_fx').insert(payload);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// GET /scenarios/:id/forecast
router.get('/:id/forecast', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const { data: scenario, error: sErr } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();
    if (sErr || !scenario) return res.status(404).json({ error: 'Not found' });

    // resolve campaign link
    const { data: linkRows, error: linkErr } = await supabase
      .from('scenario_campaign_links')
      .select('*')
      .eq('scenario_id', scenarioId);
    if (linkErr) throw linkErr;
    const campaignId = (linkRows && linkRows[0]?.campaign_id) || scenario.base_campaign_id;
    if (!campaignId) return res.status(404).json({ error: 'Not found' });

    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (cErr || !campaign) return res.status(404).json({ error: 'Not found' });

    // campaign inputs
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

    // products
    const { data: prodRows, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);
    if (pErr) throw pErr;

    // scenario overrides
    const { data: prodOv, error: poErr } = await supabase
      .from('scenario_products')
      .select('*')
      .eq('scenario_id', scenarioId);
    if (poErr) throw poErr;

    const { data: opexOv, error: ooErr } = await supabase
      .from('scenario_opex')
      .select('*')
      .eq('scenario_id', scenarioId);
    if (ooErr) throw ooErr;

    // attached opex for campaign
    const { data: campOpexLinks, error: colErr } = await supabase
      .from('campaign_opex')
      .select('*')
      .eq('campaign_id', campaignId);
    if (colErr) throw colErr;
    const attachedOpexIds = (campOpexLinks || []).map((r) => r.opex_id);
    let attachedOpex = [];
    if (attachedOpexIds.length) {
      const { data: oRows, error: oErr } = await supabase
        .from('opex_items')
        .select('*')
        .in('id', attachedOpexIds);
      if (oErr) throw oErr;
      attachedOpex = oRows || [];
    }

    const forecast = buildScenarioForecast({
      products: prodRows || [],
      campaign: {
        ...campaign,
        _quantities: quantities,
        _month_weights: month_weights,
        _product_month_weights: product_month_weights,
        _size_breakdown: size_breakdown,
        _attached_opex: attachedOpex,
      },
      scenario_product_overrides: prodOv || [],
      scenario_opex_overrides: opexOv || [],
      distributionModeOverride: req.query.distributionMode,
      customWeightsOverride: parseCustomWeights(req.query.customWeights),
    });

    // shape response per contract
    return res.json({
      monthly: forecast.monthly.map((row) => ({
        month: row.month,
        month_nice: row.month_nice,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        qty: row.qty,
        price_bdt: row.price_bdt,
        effective_price_bdt: row.effective_price,
        gross_revenue: row.gross_revenue,
        effective_revenue: row.effective_revenue,
        total_cost: row.total_cost,
        net_profit: row.net_profit,
      })),
      product_summary: forecast.product_summary.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        category: p.category,
        campaign_qty: p.campaign_qty,
        gross_revenue: p.gross_revenue,
        effective_revenue: p.effective_revenue,
        total_cost: p.total_cost,
        net_profit: p.net_profit,
        'gross_margin_%': p['gross_margin_%'],
        'net_margin_%': p['net_margin_%'],
      })),
      totals: forecast.totals,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
