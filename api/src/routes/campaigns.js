import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middlewares/auth.js';
import {
  buildCampaignForecast,
} from '../services/forecast.js';

const router = Router();
const supabase = getSupabase();

const CAMPAIGN_FIELDS = [
  'id',
  'name',
  'start_date',
  'end_date',
  'distribution_mode',
  'currency',
  'created_at',
  'updated_at',
];

const pickCampaign = (row = {}) =>
  CAMPAIGN_FIELDS.reduce((acc, key) => {
    if (key in row) acc[key] = row[key];
    return acc;
  }, {});

const nowIso = () => new Date().toISOString();

const parseBool = (val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  const normalized = String(val).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
};

const isObject = (val) => val && typeof val === 'object' && !Array.isArray(val);

// GET /campaigns
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ items: (data || []).map(pickCampaign) });
  } catch (err) {
    return next(err);
  }
});

// POST /campaigns
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const payload = {
      name: body.name,
      start_date: body.start_date,
      end_date: body.end_date,
      distribution_mode: body.distribution_mode || 'Uniform',
      currency: body.currency || 'BDT',
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const { data, error } = await supabase.from('campaigns').insert(payload).select('*').single();
    if (error) throw error;

    return res.status(201).json(pickCampaign(data));
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const campaignId = req.params.id;

    const { data: existing, error: findErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (findErr || !existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const payload = {
      updated_at: nowIso(),
    };

    ['name', 'start_date', 'end_date', 'distribution_mode', 'currency'].forEach((field) => {
      if (field in body) payload[field] = body[field];
    });

    const { data, error } = await supabase
      .from('campaigns')
      .update(payload)
      .eq('id', campaignId)
      .select('*')
      .single();
    if (error) throw error;

    return res.json(pickCampaign(data));
  } catch (err) {
    return next(err);
  }
});

// GET /campaigns/:id/inputs
router.get('/:id/inputs', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (cErr || !campaign) return res.status(404).json({ error: 'Not found' });

    // quantities
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

    // month weights (legacy: product_id null)
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

    // size breakdown
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

    return res.json({
      campaign: pickCampaign(campaign),
      quantities,
      month_weights,
      product_month_weights,
      size_breakdown,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/quantities
router.put('/:id/quantities', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { quantities } = req.body || {};
    if (!isObject(quantities)) {
      return res.status(400).json({ error: 'Invalid quantities' });
    }

    const rows = Object.entries(quantities).reduce((acc, [pid, qty]) => {
      const num = Number(qty || 0);
      if (Number.isNaN(num) || num <= 0) return acc;
      acc.push({
        campaign_id: campaignId,
        product_id: pid,
        total_qty: num,
      });
      return acc;
    }, []);

    // replace all quantities for campaign
    const { error: delErr } = await supabase
      .from('campaign_quantities')
      .delete()
      .eq('campaign_id', campaignId);
    if (delErr) throw delErr;

    if (rows.length) {
      const { error: insErr } = await supabase.from('campaign_quantities').insert(rows);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/month-weights
router.put('/:id/month-weights', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const weights = req.body || {};
    if (!isObject(weights)) {
      return res.status(400).json({ error: 'Invalid weights' });
    }

    const rows = Object.entries(weights).reduce((acc, [month_label, weight]) => {
      const num = Number(weight || 0);
      if (Number.isNaN(num) || num < 0) return acc;
      acc.push({ campaign_id: campaignId, month_label, weight: num });
      return acc;
    }, []);

    // delete legacy rows (product_id null)
    const { error: delErr } = await supabase
      .from('campaign_month_weights')
      .delete()
      .eq('campaign_id', campaignId)
      .is('product_id', null);
    if (delErr) throw delErr;

    if (rows.length) {
      const { error: insErr } = await supabase.from('campaign_month_weights').insert(rows);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/product-month-weights
router.put('/:id/product-month-weights', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const body = req.body || {};
    if (!isObject(body)) {
      return res.status(400).json({ error: 'Invalid weights' });
    }

    // iterate per product
    // delete existing rows per product before insert
    for (const [pid, map] of Object.entries(body)) {
      if (!isObject(map)) continue;

      const rows = Object.entries(map).reduce((acc, [month_label, weight]) => {
        const num = Number(weight || 0);
        if (Number.isNaN(num) || num < 0) return acc;
        acc.push({
          campaign_id: campaignId,
          product_id: pid,
          month_label,
          weight: num,
        });
        return acc;
      }, []);

      const { error: delErr } = await supabase
        .from('campaign_month_weights')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('product_id', pid);
      if (delErr) throw delErr;

      if (rows.length) {
        const { error: insErr } = await supabase.from('campaign_month_weights').insert(rows);
        if (insErr) throw insErr;
      }
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/sizes
router.put('/:id/sizes', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const body = req.body || {};
    if (!isObject(body)) {
      return res.status(400).json({ error: 'Invalid sizes' });
    }

    const rows = [];
    Object.entries(body).forEach(([pid, sizes]) => {
      if (!isObject(sizes)) return;
      Object.entries(sizes).forEach(([size, qty]) => {
        const num = Number(qty || 0);
        if (Number.isNaN(num) || num <= 0) return;
        rows.push({
          campaign_id: campaignId,
          product_id: pid,
          size,
          qty: num,
        });
      });
    });

    const { error: delErr } = await supabase
      .from('campaign_size_breakdown')
      .delete()
      .eq('campaign_id', campaignId);
    if (delErr) throw delErr;

    if (rows.length) {
      const { error: insErr } = await supabase.from('campaign_size_breakdown').insert(rows);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true });
  } catch (err) {
    return next(err);
  }
});

// GET /campaigns/:id/forecast
router.get('/:id/forecast', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const includeSizes = parseBool(req.query.includeSizes);

    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (cErr || !campaign) return res.status(404).json({ error: 'Not found' });

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

    let size_breakdown = {};
    if (includeSizes === undefined || includeSizes === true) {
      const { data: sbRows, error: sbErr } = await supabase
        .from('campaign_size_breakdown')
        .select('*')
        .eq('campaign_id', campaignId);
      if (sbErr) throw sbErr;
      size_breakdown = {};
      (sbRows || []).forEach((r) => {
        if (!size_breakdown[r.product_id]) size_breakdown[r.product_id] = {};
        size_breakdown[r.product_id][r.size] = Number(r.qty || 0);
      });
    }

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

    return res.json({
      monthly: forecast.monthly,
      product_summary: forecast.product_summary,
      size_breakdown: forecast.size_breakdown,
      totals: forecast.totals,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
