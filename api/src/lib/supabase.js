import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Singleton Supabase client
let supabaseClient;

export const getSupabase = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }
  return supabaseClient;
};
