import { Router } from 'express';
import ExcelJS from 'exceljs';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middlewares/auth.js';
import { buildCampaignForecast } from '../services/forecast.js';
import { workbookToBase64, addSheetFromObjects } from '../utils/excel.js';

const router = Router();
const supabase = getSupabase();

const notFound = (res) => res.status(404).json({ error: 'Not found' });

// GET /exports/products
router.get('/exports/products', requireAuth, async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;

    const workbook = new ExcelJS.Workbook();
    addSheetFromObjects(workbook, 'Products', data || []);
    const file = await workbookToBase64(workbook);

    return res.json({ file, file_name: 'Products.xlsx' });
  } catch (err) {
    return next(err);
  }
});

// GET /exports/opex
router.get('/exports/opex', requireAuth, async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('opex_items').select('*');
    if (error) throw error;

    const workbook = new ExcelJS.Workbook();
    addSheetFromObjects(workbook, 'OPEX_Items', data || []);
    const file = await workbookToBase64(workbook);

    return res.json({ file, file_name: 'OPEX_Items.xlsx' });
  } catch (err) {
    return next(err);
  }
});

// GET /exports/campaigns/:id
router.get('/exports/campaigns/:id', requireAuth, async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (cErr || !campaign) return notFound(res);

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);
    if (pErr) throw pErr;

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
    (mwRows || []).forEach((r) => {
      if (!r.product_id) {
        month_weights[r.month_label] = Number(r.weight || 0);
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

    const forecast = buildCampaignForecast({
      products: products || [],
      quantities,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      distributionMode: campaign.distribution_mode || 'Uniform',
      customMonthWeights: Object.keys(month_weights).length ? month_weights : undefined,
      perProductMonthWeights: {},
      sizeBreakdown: size_breakdown,
    });

    const workbook = new ExcelJS.Workbook();
    addSheetFromObjects(workbook, 'Campaign Overview', [campaign]);
    addSheetFromObjects(workbook, 'Product Summary', forecast.product_summary || []);
    addSheetFromObjects(workbook, 'Monthly Forecast', forecast.monthly || []);
    if (forecast.size_breakdown && forecast.size_breakdown.length) {
      addSheetFromObjects(workbook, 'Size Breakdown', forecast.size_breakdown);
    }

    const safeName = (campaign.name || 'campaign').replace(/\\s+/g, '_');
    const file = await workbookToBase64(workbook);
    return res.json({ file, file_name: `campaign_${safeName}.xlsx` });
  } catch (err) {
    return next(err);
  }
});

// GET /exports/scenarios/:id
router.get('/exports/scenarios/:id', requireAuth, async (req, res, next) => {
  try {
    const scenarioId = req.params.id;
    const { data: scenario, error: sErr } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();
    if (sErr || !scenario) return notFound(res);

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

    const { data: fxOv, error: fxErr } = await supabase
      .from('scenario_fx')
      .select('*')
      .eq('scenario_id', scenarioId);
    if (fxErr) throw fxErr;

    const { data: links, error: linkErr } = await supabase
      .from('scenario_campaign_links')
      .select('*')
      .eq('scenario_id', scenarioId);
    if (linkErr) throw linkErr;

    const workbook = new ExcelJS.Workbook();
    addSheetFromObjects(workbook, 'Scenario_Info', [scenario]);
    addSheetFromObjects(workbook, 'Product_Overrides', prodOv || []);
    addSheetFromObjects(workbook, 'OPEX_Overrides', opexOv || []);
    addSheetFromObjects(workbook, 'FX_Overrides', fxOv || []);
    addSheetFromObjects(workbook, 'Linked_Campaigns', links || []);

    const safeName = (scenario.name || 'Scenario').replace(/\\s+/g, '_');
    const file = await workbookToBase64(workbook);
    return res.json({ file, file_name: `Scenario_${safeName}.xlsx` });
  } catch (err) {
    return next(err);
  }
});

export default router;
