import { Router, type Request, type Response, type NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { sendInstagramMessage, sendWhatsAppMessage } from '../lib/meta.js';
import { reelQueue, ingestQueue } from '../workers/queue.js';

export const adminRouter = Router();

// Auth middleware: valida JWT Supabase y verifica si email está en admin_emails
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'missing bearer' } });
    return;
  }
  const token = auth.slice(7);
  const { data, error } = await supabase().auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'invalid token' } });
    return;
  }
  const { data: admin } = await supabase()
    .from('admin_emails')
    .select('email')
    .eq('email', data.user.email!)
    .maybeSingle();
  if (!admin) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'not admin' } });
    return;
  }
  (req as any).adminUser = data.user;
  next();
}

adminRouter.use(requireAdmin);

adminRouter.get('/conversations', async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 200);
  const channel = req.query.channel as string | undefined;
  let q = supabase()
    .from('conversations')
    .select('id, user_id, channel, started_at, last_message_at, message_count, satisfaction, topics, flagged')
    .order('last_message_at', { ascending: false })
    .limit(limit);
  if (channel) q = q.eq('channel', channel);
  if (req.query.flagged === 'true') q = q.eq('flagged', true);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json({ conversations: data });
});

adminRouter.get('/conversations/:id', async (req, res) => {
  const { data: conv } = await supabase()
    .from('conversations')
    .select('*')
    .eq('id', req.params.id)
    .single();
  const { data: msgs } = await supabase()
    .from('messages')
    .select('id, role, content, created_at, claude_call_id, tool_calls')
    .eq('conversation_id', req.params.id)
    .order('created_at');
  const { data: costs } = await supabase()
    .from('claude_calls')
    .select('cost_usd')
    .eq('conversation_id', req.params.id);
  const total_cost = (costs ?? []).reduce((s, c: any) => s + Number(c.cost_usd), 0);
  res.json({ conversation: conv, messages: msgs, total_cost_usd: total_cost });
});

adminRouter.post('/conversations/:id/override', async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) return res.status(400).json({ error: { message: 'message required' } });

  const { data: conv } = await supabase()
    .from('conversations')
    .select('user_id, channel')
    .eq('id', req.params.id)
    .single();
  if (!conv) return res.status(404).json({ error: { message: 'not found' } });

  const { data: user } = await supabase()
    .from('app_users')
    .select('external_id')
    .eq('id', conv.user_id)
    .single();
  if (!user) return res.status(404).json({ error: { message: 'user not found' } });

  // Pausar bot 24h
  await supabase()
    .from('app_users')
    .update({ human_in_loop_until: new Date(Date.now() + 24 * 3600_000).toISOString() })
    .eq('id', conv.user_id);

  // Enviar el mensaje
  if (conv.channel === 'instagram') {
    await sendInstagramMessage(user.external_id, message);
  } else {
    await sendWhatsAppMessage(user.external_id, message);
  }

  await supabase().from('messages').insert({
    conversation_id: req.params.id,
    role: 'assistant',
    content: `[OPERATOR] ${message}`,
    tool_calls: { override_by: (req as any).adminUser?.email }
  });

  await supabase().from('audit_log').insert({
    actor_email: (req as any).adminUser?.email,
    action: 'override_message',
    target_type: 'conversation',
    target_id: req.params.id,
    payload: { message_preview: message.slice(0, 100) }
  });

  res.json({ ok: true });
});

adminRouter.get('/metrics/daily', async (req, res) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  const { data } = await supabase()
    .from('daily_metrics')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date');
  res.json({ data });
});

adminRouter.get('/metrics/topics', async (_req, res) => {
  const { data } = await supabase().rpc('get_top_topics', { days_back: 30, top_n: 10 });
  res.json({ topics: data ?? [] });
});

adminRouter.get('/reels', async (_req, res) => {
  const { data } = await supabase()
    .from('videos')
    .select('id, topic, caption, asset_url, ig_media_id, published_at')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(50);
  res.json({ reels: data });
});

adminRouter.post('/reels/regenerate', async (req, res) => {
  const job = await reelQueue.add('manual-generate', { override: req.body.prompt_override, publish: !!req.body.publish });
  res.json({ job_id: job.id });
});

adminRouter.get('/regulations', async (req, res) => {
  const q = (req.query.q as string) || '';
  let query = supabase()
    .from('regulations')
    .select('id, title, source_url, document_type, effective_date, last_indexed_at')
    .eq('superseded', false);
  if (q) query = query.ilike('title', `%${q}%`);
  const { data } = await query.order('last_indexed_at', { ascending: false }).limit(100);
  res.json({ regulations: data });
});

adminRouter.post('/regulations/reingest', async (_req, res) => {
  const job = await ingestQueue.add('reingest-all', {});
  res.json({ job_id: job.id });
});

adminRouter.get('/cost-summary', async (req, res) => {
  const days = parseInt((req.query.days as string) || '7');
  const { data } = await supabase().rpc('get_cost_summary', { days_back: days });
  res.json({ summary: data ?? [] });
});

adminRouter.post('/users/:externalId/block', async (req, res) => {
  const { externalId } = req.params;
  await supabase().from('app_users').update({ blocked: true }).eq('external_id', externalId);
  await supabase().from('audit_log').insert({
    actor_email: (req as any).adminUser?.email,
    action: 'block_user',
    target_type: 'user',
    payload: { external_id: externalId }
  });
  res.json({ ok: true });
});

adminRouter.delete('/users/:externalId', async (req, res) => {
  // Right to erasure
  const { externalId } = req.params;
  await supabase().from('app_users').delete().eq('external_id', externalId);
  await supabase().from('audit_log').insert({
    actor_email: (req as any).adminUser?.email,
    action: 'delete_user',
    target_type: 'user',
    payload: { external_id: externalId }
  });
  res.json({ ok: true });
});
