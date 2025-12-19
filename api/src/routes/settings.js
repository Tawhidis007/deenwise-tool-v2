import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

const DEFAULT_SETTINGS = {
  currency: 'BDT',
  exchange_rates: {
    BDT: 1,
    USD: 117,
    GBP: 146,
  },
};

let currentSettings = { ...DEFAULT_SETTINGS };

const validateSettings = (body) => {
  const errors = [];
  const { currency, exchange_rates } = body || {};

  if (!['BDT', 'USD', 'GBP'].includes(currency || '')) {
    errors.push('currency must be one of BDT, USD, GBP');
  }

  if (!exchange_rates || typeof exchange_rates !== 'object') {
    errors.push('exchange_rates must be an object');
  } else {
    ['BDT', 'USD', 'GBP'].forEach((code) => {
      const val = exchange_rates[code];
      if (val === undefined || val === null) {
        errors.push(`exchange_rates.${code} is required`);
      } else if (Number.isNaN(Number(val)) || Number(val) <= 0) {
        errors.push(`exchange_rates.${code} must be a positive number`);
      }
    });
  }

  return errors;
};

// GET /settings/display
router.get('/settings/display', requireAuth, (req, res) => {
  return res.json(currentSettings);
});

// PUT /settings/display
router.put('/settings/display', requireAuth, (req, res) => {
  const errors = validateSettings(req.body || {});
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  currentSettings = {
    currency: req.body.currency,
    exchange_rates: {
      BDT: Number(req.body.exchange_rates.BDT),
      USD: Number(req.body.exchange_rates.USD),
      GBP: Number(req.body.exchange_rates.GBP),
    },
  };

  return res.json(currentSettings);
});

export default router;
