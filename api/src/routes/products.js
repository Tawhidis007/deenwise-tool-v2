import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();
const supabase = getSupabase();

const PRODUCT_FIELDS = [
  'id',
  'product_code',
  'name',
  'category',
  'price_bdt',
  'manufacturing_cost_bdt',
  'packaging_cost_bdt',
  'shipping_cost_bdt',
  'marketing_cost_bdt',
  'return_rate',
  'discount_rate',
  'vat_included',
  'notes',
  'is_active',
  'created_at',
  'updated_at',
];

const pickProduct = (row = {}) =>
  PRODUCT_FIELDS.reduce((acc, key) => {
    if (key in row) acc[key] = row[key];
    return acc;
  }, {});

const boolFromParam = (val) => {
  if (val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  const normalized = String(val).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
};

const nowIso = () => new Date().toISOString();

const validateProduct = (body, { partial = false } = {}) => {
  const errors = [];
  const required = ['name', 'category', 'price_bdt', 'manufacturing_cost_bdt'];
  const numericFields = [
    'price_bdt',
    'manufacturing_cost_bdt',
    'packaging_cost_bdt',
    'shipping_cost_bdt',
    'marketing_cost_bdt',
    'return_rate',
    'discount_rate',
  ];

  if (!partial) {
    required.forEach((field) => {
      const val = body[field];
      if (val === undefined || val === null || val === '') {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  numericFields.forEach((field) => {
    if (body[field] === undefined || body[field] === null) return;
    const num = Number(body[field]);
    if (Number.isNaN(num)) {
      errors.push(`${field} must be a number`);
      return;
    }
    if (num < 0) {
      errors.push(`${field} cannot be negative`);
    }
    if (['return_rate', 'discount_rate'].includes(field) && (num < 0 || num > 1)) {
      errors.push(`${field} must be between 0 and 1`);
    }
  });

  return errors;
};

const generateProductCode = (name) => {
  if (!name) return undefined;
  const suffix = randomUUID().replace(/-/g, '').slice(0, 4);
  return `${name.toUpperCase().replace(/\\s+/g, '-')}-${suffix}`;
};

// GET /products
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const activeParam = boolFromParam(req.query.active);
    let query = supabase.from('products').select('*').order('created_at', { ascending: true });

    if (activeParam === undefined || activeParam === true) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data || []).map(pickProduct);
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

// POST /products
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validateProduct(body);
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const payload = {
      product_code: body.product_code || generateProductCode(body.name),
      name: body.name,
      category: body.category,
      price_bdt: Number(body.price_bdt),
      manufacturing_cost_bdt: Number(body.manufacturing_cost_bdt),
      packaging_cost_bdt: Number(body.packaging_cost_bdt || 0),
      shipping_cost_bdt: Number(body.shipping_cost_bdt || 0),
      marketing_cost_bdt: Number(body.marketing_cost_bdt || 0),
      return_rate: Number(body.return_rate || 0),
      discount_rate: Number(body.discount_rate || 0),
      vat_included: body.vat_included !== undefined ? Boolean(body.vat_included) : true,
      notes: body.notes || '',
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const { data, error } = await supabase.from('products').insert(payload).select('*').single();
    if (error) throw error;

    return res.status(201).json(pickProduct(data));
  } catch (err) {
    return next(err);
  }
});

// PUT /products/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validateProduct(body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const productId = req.params.id;
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const payload = {
      updated_at: nowIso(),
    };

    const numericFields = new Set([
      'price_bdt',
      'manufacturing_cost_bdt',
      'packaging_cost_bdt',
      'shipping_cost_bdt',
      'marketing_cost_bdt',
      'return_rate',
      'discount_rate',
    ]);

    PRODUCT_FIELDS.forEach((field) => {
      if (field === 'id' || field === 'created_at' || field === 'updated_at') return;
      if (!(field in body)) return;

      if (numericFields.has(field)) {
        payload[field] = Number(body[field]);
      } else if (field === 'vat_included' || field === 'is_active') {
        payload[field] = Boolean(body[field]);
      } else {
        payload[field] = body[field];
      }
    });

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .select('*')
      .single();
    if (error) throw error;

    return res.json(pickProduct(data));
  } catch (err) {
    return next(err);
  }
});

// DELETE /products/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const productId = req.params.id;

    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
