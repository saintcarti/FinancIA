import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
});

export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`${apiBase}${path}`, { ...init, headers });
}
