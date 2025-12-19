import { getSupabase } from '../lib/supabase.js';
import { env } from '../config/env.js';

/**
 * Auth middleware validating Supabase bearer token.
 * On success, attaches `req.user` with Supabase user object.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Allow open access (no token) to mirror Streamlit behavior.
    if (!token) {
      req.user = { role: 'anon' };
      return next();
    }

    // Allow direct API key use (anon/service) to mirror Streamlit open access.
    if (token && token === env.SUPABASE_KEY) {
      req.user = { role: 'service' };
      return next();
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = data.user;
    return next();
  } catch (err) {
    return next(err);
  }
};
