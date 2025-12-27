import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../lib/supabase.js';

const router = Router();

const fetchUserByUsername = async (username) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_users')
    .select('id, username, password_hash, is_active')
    .eq('username', username)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
};

router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const user = await fetchUserByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ ok: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    return next(err);
  }
});

router.post('/auth/change-password', async (req, res, next) => {
  try {
    const { username, current_password, new_password } = req.body || {};
    if (!username || !current_password || !new_password) {
      return res.status(400).json({ error: 'username, current_password, and new_password are required' });
    }

    const user = await fetchUserByUsername(username.trim());
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    const supabase = getSupabase();
    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update password' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
