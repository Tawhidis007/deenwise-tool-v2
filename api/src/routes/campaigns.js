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
      distribution_mode: 'Custom',
      enable_size_breakdown: true,
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

    ['name', 'start_date', 'end_date', 'currency'].forEach((field) => {
      if (field in body) payload[field] = body[field];
    });
    payload.distribution_mode = 'Custom';
    payload.enable_size_breakdown = true;

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

    const { data: opexRows, error: opexErr } = await supabase
      .from('campaign_opex')
      .select('opex_id')
      .eq('campaign_id', campaignId);
    if (opexErr) throw opexErr;
    const opex_ids = (opexRows || []).map((r) => r.opex_id);

    let attached_opex = [];
    if (opex_ids.length) {
      const { data: opexItems, error: opexItemsErr } = await supabase
        .from('opex_items')
        .select('*')
        .in('id', opex_ids);
      if (opexItemsErr) throw opexItemsErr;
      attached_opex = opexItems || [];
    }

    const { data: overrideRows, error: ovErr } = await supabase
      .from('campaign_product_overrides')
      .select('*')
      .eq('campaign_id', campaignId);
    if (ovErr) throw ovErr;
    const product_overrides = {};
    (overrideRows || []).forEach((r) => {
      product_overrides[r.product_id] = {
        packaging_cost_bdt: r.packaging_cost_bdt !== null ? Number(r.packaging_cost_bdt) : null,
        marketing_cost_bdt: r.marketing_cost_bdt !== null ? Number(r.marketing_cost_bdt) : null,
        discount_rate: r.discount_rate !== null ? Number(r.discount_rate) : null,
        return_rate: r.return_rate !== null ? Number(r.return_rate) : null,
      };
    });

    const { data: marketingRow, error: marketingErr } = await supabase
      .from('campaign_marketing_totals')
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (marketingErr && marketingErr.code !== 'PGRST116') throw marketingErr;
    const marketing_total =
      marketingRow && marketingRow.marketing_cost_total_bdt !== null
        ? Number(marketingRow.marketing_cost_total_bdt)
        : null;

    return res.json({
      campaign: { ...pickCampaign(campaign), opex_ids, attached_opex, marketing_total },
      quantities,
      month_weights,
      product_month_weights,
      size_breakdown,
      product_overrides,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/product-overrides
router.put('/:id/product-overrides', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const overrides = req.body?.overrides;
    if (!isObject(overrides)) {
      return res.status(400).json({ error: 'Invalid overrides' });
    }

    const rows = Object.entries(overrides).reduce((acc, [product_id, vals]) => {
      if (!isObject(vals)) return acc;
      const packaging_cost_bdt = vals.packaging_cost_bdt ?? null;
      const marketing_cost_bdt = vals.marketing_cost_bdt ?? null;
      const discount_rate = vals.discount_rate ?? null;
      const return_rate = vals.return_rate ?? null;

      const hasValue =
        packaging_cost_bdt !== null ||
        marketing_cost_bdt !== null ||
        discount_rate !== null ||
        return_rate !== null;
      if (!hasValue) return acc;

      acc.push({
        campaign_id: campaignId,
        product_id,
        packaging_cost_bdt: packaging_cost_bdt === null ? null : Number(packaging_cost_bdt),
        marketing_cost_bdt: marketing_cost_bdt === null ? null : Number(marketing_cost_bdt),
        discount_rate: discount_rate === null ? null : Number(discount_rate),
        return_rate: return_rate === null ? null : Number(return_rate),
        updated_at: nowIso(),
      });
      return acc;
    }, []);

    const { error: delErr } = await supabase
      .from('campaign_product_overrides')
      .delete()
      .eq('campaign_id', campaignId);
    if (delErr) throw delErr;

    if (rows.length) {
      const { error: insErr } = await supabase.from('campaign_product_overrides').insert(rows);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true, count: rows.length });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/marketing-total
router.put('/:id/marketing-total', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const raw = req.body?.marketing_cost_total_bdt;
    const value = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) {
      return res.status(400).json({ error: 'Invalid marketing_cost_total_bdt' });
    }

    if (value === null) {
      const { error: delErr } = await supabase
        .from('campaign_marketing_totals')
        .delete()
        .eq('campaign_id', campaignId);
      if (delErr) throw delErr;
      return res.json({ saved: true, marketing_cost_total_bdt: null });
    }

    const { error } = await supabase
      .from('campaign_marketing_totals')
      .upsert({
        campaign_id: campaignId,
        marketing_cost_total_bdt: value,
        updated_at: nowIso(),
      })
      .eq('campaign_id', campaignId);
    if (error) throw error;

    return res.json({ saved: true, marketing_cost_total_bdt: value });
  } catch (err) {
    return next(err);
  }
});

// PUT /campaigns/:id/opex
router.put('/:id/opex', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const opexIds = Array.isArray(req.body?.opexIds) ? req.body.opexIds.filter(Boolean) : null;
    if (!opexIds) {
      return res.status(400).json({ error: 'Invalid opexIds' });
    }

    const rows = opexIds.map((oid) => ({
      campaign_id: campaignId,
      opex_id: oid,
      updated_at: nowIso(),
    }));

    const { error: delErr } = await supabase.from('campaign_opex').delete().eq('campaign_id', campaignId);
    if (delErr) throw delErr;

    if (rows.length) {
      const { error: insErr } = await supabase.from('campaign_opex').insert(rows);
      if (insErr) throw insErr;
    }

    return res.json({ saved: true, count: rows.length });
  } catch (err) {
    return next(err);
  }
});

// DELETE /campaigns/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  const safeDelete = async (table, col = 'campaign_id', val) => {
    const target = val ?? req.params.id;
    try {
      const { error } = await supabase.from(table).delete().eq(col, target);
      if (error) {
        console.warn(`Delete cascade skipped for ${table}: ${error.message || error.code || error}`);
      }
    } catch (err) {
      console.warn(`Delete cascade error for ${table}: ${err.message || err.code || err}`);
    }
  };

  try {
    const campaignId = req.params.id;

    const { data: existing, error: findErr } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .single();
    if (findErr || !existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    // delete scenario attachments that reference this campaign as base
    const { data: scenarioRows, error: scenarioFindErr } = await supabase
      .from('scenarios')
      .select('id')
      .eq('base_campaign_id', campaignId);
    if (scenarioFindErr && !['PGRST116', 'PGRST204'].includes(scenarioFindErr.code)) throw scenarioFindErr;
    const scenarioIds = (scenarioRows || []).map((r) => r.id);

    for (const sid of scenarioIds) {
      await safeDelete('scenario_products', 'scenario_id', sid);
      await safeDelete('scenario_opex', 'scenario_id', sid);
      await safeDelete('scenario_campaign_links', 'scenario_id', sid);
    }
    // delete scenarios themselves
    await safeDelete('scenarios', 'base_campaign_id', campaignId);

    const tables = [
      'campaign_quantities',
      'campaign_month_weights',
      'campaign_size_breakdown',
      'campaign_product_overrides',
      'campaign_marketing_totals',
      'campaign_opex',
      'scenario_campaign_links',
    ];

    for (const table of tables) {
      await safeDelete(table);
    }

    const { error: delCampaignErr } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (delCampaignErr) throw delCampaignErr;

    return res.json({ deleted: true, id: campaignId });
  } catch (err) {
    // log to help diagnose which table failed
    console.error('Delete campaign failed', { campaignId: req.params.id, error: err });
    return res.status(500).json({ error: 'Failed to delete campaign', detail: err?.message || err?.toString?.() });
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

    // apply per-campaign overrides (packaging, marketing, discount, return)
    const { data: overrideRows, error: ovErr } = await supabase
      .from('campaign_product_overrides')
      .select('*')
      .eq('campaign_id', campaignId);
    if (ovErr) throw ovErr;
    const overrideMap = (overrideRows || []).reduce((acc, row) => {
      acc[row.product_id] = {
        packaging_cost_bdt:
          row.packaging_cost_bdt === null || row.packaging_cost_bdt === undefined
            ? undefined
            : Number(row.packaging_cost_bdt),
        marketing_cost_bdt:
          row.marketing_cost_bdt === null || row.marketing_cost_bdt === undefined
            ? undefined
            : Number(row.marketing_cost_bdt),
        discount_rate:
          row.discount_rate === null || row.discount_rate === undefined
            ? undefined
            : Number(row.discount_rate),
        return_rate:
          row.return_rate === null || row.return_rate === undefined
            ? undefined
            : Number(row.return_rate),
      };
      return acc;
    }, {});

    const mergedProducts = (prodRows || []).map((p) => {
      const ov = overrideMap[p.id];
      if (!ov) return p;
      return {
        ...p,
        packaging_cost_bdt: ov.packaging_cost_bdt !== undefined ? ov.packaging_cost_bdt : p.packaging_cost_bdt,
        marketing_cost_bdt: ov.marketing_cost_bdt !== undefined ? ov.marketing_cost_bdt : p.marketing_cost_bdt,
        discount_rate: ov.discount_rate !== undefined ? ov.discount_rate : p.discount_rate,
        return_rate: ov.return_rate !== undefined ? ov.return_rate : p.return_rate,
      };
    });

    const forecast = buildCampaignForecast({
      products: mergedProducts || [],
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
