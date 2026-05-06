import { supabase } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { runQA } from '../agents/qa.js';
import { summarizeConversation } from '../agents/summarizer.js';
import type Anthropic from '@anthropic-ai/sdk';

export interface IncomingMessage {
  externalUserId: string;
  channel: 'instagram' | 'whatsapp';
  metaMessageId: string;
  text: string;
  timestamp: number;
}

const RECENT_TURNS_KEEP = 6;
const SUMMARIZE_AFTER = 5; // resumir cuando hay 5+ turnos sin sumarizar

/** Idempotencia: claim el meta_message_id. Devuelve true si es nuevo, false si ya estaba. */
export async function claimWebhook(metaMessageId: string, channel: string): Promise<boolean> {
  const { error } = await supabase()
    .from('processed_webhooks')
    .insert({ meta_message_id: metaMessageId, channel });
  if (error?.code === '23505') return false; // unique violation → ya procesado
  if (error) {
    logger.error({ err: error.message }, 'claimWebhook failed');
    return false;
  }
  return true;
}

/** Upsert app_user y devuelve user_id (UUID interno). */
export async function ensureUser(externalId: string, channel: string): Promise<string> {
  const sb = supabase();
  const { data: existing } = await sb
    .from('app_users')
    .select('id, blocked, human_in_loop_until')
    .eq('external_id', externalId)
    .eq('channel', channel)
    .maybeSingle();

  if (existing) {
    if (existing.blocked) throw new Error('user_blocked');
    return existing.id;
  }

  const { data, error } = await sb
    .from('app_users')
    .insert({ external_id: externalId, channel })
    .select('id')
    .single();
  if (error || !data) throw new Error(`ensureUser failed: ${error?.message}`);
  return data.id;
}

/** Trae la conversación abierta más reciente o crea una nueva. */
export async function getOrCreateConversation(userId: string, channel: string): Promise<{
  id: string;
  summary: string;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}> {
  const sb = supabase();
  const { data: latest } = await sb
    .from('conversations')
    .select('id, summary, last_message_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Si la última conversación es < 12h vieja, continuamos. Si no, abrimos nueva.
  const STALE_HOURS = 12;
  let conversationId: string;
  let summary = '';
  if (latest && Date.now() - new Date(latest.last_message_at).getTime() < STALE_HOURS * 3600_000) {
    conversationId = latest.id;
    summary = latest.summary ?? '';
  } else {
    const { data: created, error } = await sb
      .from('conversations')
      .insert({ user_id: userId, channel })
      .select('id')
      .single();
    if (error || !created) throw new Error(`create conv failed: ${error?.message}`);
    conversationId = created.id;
  }

  const { data: msgs } = await sb
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(RECENT_TURNS_KEEP);

  const recentMessages = ((msgs ?? []) as Array<{ role: string; content: string }>)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  return { id: conversationId, summary, recentMessages };
}

export async function persistMessage(opts: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  metaMessageId?: string;
  toolCalls?: unknown;
}): Promise<string> {
  const { data, error } = await supabase()
    .from('messages')
    .insert({
      conversation_id: opts.conversationId,
      role: opts.role,
      content: opts.content,
      meta_message_id: opts.metaMessageId ?? null,
      tool_calls: opts.toolCalls ?? null
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`persistMessage failed: ${error?.message}`);
  return data.id;
}

/** Si pasaron N turnos desde el último resumen, re-sumarizar async. */
export async function maybeSummarize(conversationId: string): Promise<void> {
  const sb = supabase();
  const { data: conv } = await sb
    .from('conversations')
    .select('message_count, summary, summary_updated_at')
    .eq('id', conversationId)
    .single();
  if (!conv) return;

  const since = conv.summary_updated_at
    ? Math.floor((Date.now() - new Date(conv.summary_updated_at).getTime()) / 60000)
    : Infinity;

  // Resumir si han pasado 5+ mensajes y al menos 1 minuto desde el último resumen
  if (conv.message_count < SUMMARIZE_AFTER || since < 1) return;

  const { data: msgs } = await sb
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (!msgs?.length) return;

  const newTurns = (msgs as Array<{ role: string; content: string }>)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const summary = await summarizeConversation(conv.summary ?? '', newTurns);
    await sb
      .from('conversations')
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'summarize failed (non-critical)');
  }
}

/** Procesa un mensaje entrante punto a punto. */
export async function processIncomingMessage(msg: IncomingMessage): Promise<{
  reply: string;
  conversationId: string;
  bot_paused: boolean;
}> {
  const isNew = await claimWebhook(msg.metaMessageId, msg.channel);
  if (!isNew) {
    logger.info({ mid: msg.metaMessageId }, 'webhook already processed, skip');
    return { reply: '', conversationId: '', bot_paused: false };
  }

  const userId = await ensureUser(msg.externalUserId, msg.channel);

  // Verificar si el bot está pausado (human-in-loop)
  const { data: u } = await supabase()
    .from('app_users')
    .select('human_in_loop_until')
    .eq('id', userId)
    .single();

  if (u?.human_in_loop_until && new Date(u.human_in_loop_until) > new Date()) {
    logger.info({ userId }, 'bot paused due to human_in_loop');
    return { reply: '', conversationId: '', bot_paused: true };
  }

  const conv = await getOrCreateConversation(userId, msg.channel);

  // Persistir user message
  await persistMessage({
    conversationId: conv.id,
    role: 'user',
    content: msg.text,
    metaMessageId: msg.metaMessageId
  });

  // Convertir recent messages a Anthropic format
  const recentHistory: Anthropic.MessageParam[] = conv.recentMessages.map((m) => ({
    role: m.role,
    content: m.content
  }));

  const result = await runQA({
    conversationId: conv.id,
    userMessage: msg.text,
    conversationSummary: conv.summary,
    recentHistory
  });

  await persistMessage({
    conversationId: conv.id,
    role: 'assistant',
    content: result.text,
    toolCalls: { tool_calls_made: result.tool_calls_made, rag_top_score: result.rag_top_score }
  });

  // Resumir async (no bloquea respuesta)
  maybeSummarize(conv.id).catch(() => {});

  return { reply: result.text, conversationId: conv.id, bot_paused: false };
}
