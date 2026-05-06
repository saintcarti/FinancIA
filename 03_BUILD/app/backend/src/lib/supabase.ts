import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  const cfg = config();
  _client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}
