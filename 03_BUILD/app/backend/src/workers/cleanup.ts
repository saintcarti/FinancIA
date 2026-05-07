/**
 * Cleanup workers — corren periódicamente para purgar datos viejos.
 *
 * En Q1 corremos esto en proceso (no fork). Si crece, mover a cron Supabase
 * (pg_cron) o a un proceso separado.
 */
import { supabase } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/** Limpia webhooks procesados > 30 días. */
export async function purgeOldWebhooks(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { count, error } = await supabase()
    .from('processed_webhooks')
    .delete({ count: 'exact' })
    .lt('processed_at', cutoff);
  if (error) {
    logger.warn({ err: error.message }, 'purgeOldWebhooks failed');
    return 0;
  }
  if ((count ?? 0) > 0) logger.info({ count }, 'purged old webhooks');
  return count ?? 0;
}

/** Reemplaza contenido de mensajes > 90 días por [REDACTED]. */
export async function redactOldMessages(): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { count, error } = await supabase()
    .from('messages')
    .update({ content: '[REDACTED — retention policy 90d]' }, { count: 'exact' })
    .lt('created_at', cutoff)
    .neq('content', '[REDACTED — retention policy 90d]');
  if (error) {
    logger.warn({ err: error.message }, 'redactOldMessages failed');
    return 0;
  }
  if ((count ?? 0) > 0) logger.info({ count }, 'redacted old messages');
  return count ?? 0;
}

/** Recalcula daily_metrics de los últimos N días. */
export async function rollupDailyMetrics(daysBack = 7): Promise<number> {
  const sb = supabase();
  const since = new Date(Date.now() - daysBack * 86400_000).toISOString();
  const { data: rows, error } = await sb
    .from('claude_calls')
    .select('created_at, cost_usd, input_tokens, output_tokens')
    .gte('created_at', since);
  if (error) {
    logger.warn({ err: error.message }, 'rollupDailyMetrics: claude_calls fetch failed');
    return 0;
  }
  // Agrupar por día
  const byDay: Record<string, { cost: number; inp: number; out: number; calls: number }> = {};
  for (const r of (rows ?? []) as Array<{ created_at: string; cost_usd: string; input_tokens: number; output_tokens: number }>) {
    const date = r.created_at.slice(0, 10);
    byDay[date] = byDay[date] ?? { cost: 0, inp: 0, out: 0, calls: 0 };
    byDay[date].cost += Number(r.cost_usd);
    byDay[date].inp += r.input_tokens;
    byDay[date].out += r.output_tokens;
    byDay[date].calls++;
  }

  let updated = 0;
  for (const [date, agg] of Object.entries(byDay)) {
    // Conversaciones del día
    const dayStart = `${date}T00:00:00Z`;
    const dayEnd = `${date}T23:59:59Z`;
    const { count: convCount } = await sb
      .from('conversations')
      .select('*', { head: true, count: 'exact' })
      .gte('last_message_at', dayStart)
      .lte('last_message_at', dayEnd);
    const { count: msgCount } = await sb
      .from('messages')
      .select('*', { head: true, count: 'exact' })
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd);
    const { count: usefulCount } = await sb
      .from('conversations')
      .select('*', { head: true, count: 'exact' })
      .gte('last_message_at', dayStart)
      .lte('last_message_at', dayEnd)
      .gte('message_count', 3)
      .neq('satisfaction', 'thumbs_down');
    const { count: thumbsUp } = await sb
      .from('conversations')
      .select('*', { head: true, count: 'exact' })
      .gte('last_message_at', dayStart)
      .lte('last_message_at', dayEnd)
      .eq('satisfaction', 'thumbs_up');
    const { count: thumbsDown } = await sb
      .from('conversations')
      .select('*', { head: true, count: 'exact' })
      .gte('last_message_at', dayStart)
      .lte('last_message_at', dayEnd)
      .eq('satisfaction', 'thumbs_down');
    const { count: reelsCount } = await sb
      .from('videos')
      .select('*', { head: true, count: 'exact' })
      .gte('published_at', dayStart)
      .lte('published_at', dayEnd);

    await sb.from('daily_metrics').upsert(
      {
        date,
        conversations: convCount ?? 0,
        useful_conversations: usefulCount ?? 0,
        messages: msgCount ?? 0,
        thumbs_up: thumbsUp ?? 0,
        thumbs_down: thumbsDown ?? 0,
        cost_usd: Number(agg.cost.toFixed(4)),
        tokens_input: agg.inp,
        tokens_output: agg.out,
        reels_published: reelsCount ?? 0,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'date' }
    );
    updated++;
  }
  if (updated > 0) logger.info({ days: updated }, 'daily metrics rolled up');
  return updated;
}

/** Lanza cleanup en intervalos. Llamar 1 vez en startup. */
let cleanupTimers: NodeJS.Timeout[] = [];
let lastRedactDay = '';

export function startCleanupCron(): void {
  // Defensa contra doble inicio
  if (cleanupTimers.length > 0) {
    logger.warn('cleanup cron already started, skipping');
    return;
  }

  // Cada hora: purge webhooks + rollup (acumulativo)
  cleanupTimers.push(
    setInterval(() => {
      purgeOldWebhooks().catch(() => {});
      rollupDailyMetrics(2).catch(() => {});
    }, 60 * 60_000)
  );

  // Cada hora chequea si es ventana diaria (UTC 4am) — solo se ejecuta una vez por día
  cleanupTimers.push(
    setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (new Date().getUTCHours() === 4 && lastRedactDay !== today) {
        lastRedactDay = today;
        redactOldMessages().catch(() => {});
      }
    }, 60 * 60_000)
  );

  logger.info('cleanup cron started');
}

/** Detiene crons (útil para tests y graceful shutdown). */
export function stopCleanupCron(): void {
  cleanupTimers.forEach((t) => clearInterval(t));
  cleanupTimers = [];
}
