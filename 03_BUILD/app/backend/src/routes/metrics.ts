/**
 * /api/metrics — observability mínima sin Sentry.
 * Counter en proceso (no agregable entre instances) + lecturas DB.
 * Para Q1 single-instance es suficiente. Q2: Prometheus client si hace falta.
 */
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { config } from '../config.js';

export const metricsRouter = Router();

interface Counters {
  http_requests_total: number;
  webhook_received: number;
  webhook_signature_invalid: number;
  agent_calls_total: number;
  agent_errors_total: number;
  rate_limited: number;
}

const counters: Counters = {
  http_requests_total: 0,
  webhook_received: 0,
  webhook_signature_invalid: 0,
  agent_calls_total: 0,
  agent_errors_total: 0,
  rate_limited: 0
};

export function incrCounter(name: keyof Counters, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

metricsRouter.get('/', async (req, res) => {
  if (req.header('x-internal-secret') !== config().INTERNAL_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // Métricas de costo y volumen últimas 24h
  const sb = supabase();
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ data: costs }, { count: convsToday }, { count: msgsToday }] = await Promise.all([
    sb.from('claude_calls').select('cost_usd, model').gte('created_at', since24h),
    sb.from('conversations').select('*', { head: true, count: 'exact' }).gte('last_message_at', since24h),
    sb.from('messages').select('*', { head: true, count: 'exact' }).gte('created_at', since24h)
  ]);

  const costRows = (costs ?? []) as Array<{ cost_usd: string; model: string }>;
  const cost24h = costRows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const haikuPct =
    costRows.length === 0
      ? 0
      : costRows.filter((r) => r.model.includes('haiku')).length / costRows.length;

  let redisHealth = 'unknown';
  try {
    redisHealth = (await redis().ping()) === 'PONG' ? 'ok' : 'degraded';
  } catch {
    redisHealth = 'down';
  }

  res.json({
    process: {
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      node_version: process.version,
      env: config().NODE_ENV
    },
    counters,
    last_24h: {
      conversations: convsToday ?? 0,
      messages: msgsToday ?? 0,
      claude_calls: costRows.length,
      cost_usd: Number(cost24h.toFixed(4)),
      haiku_pct: Number(haikuPct.toFixed(3))
    },
    deps: { redis: redisHealth, db: 'ok' }
  });
});

/** Versión Prometheus-compatible (text format). */
metricsRouter.get('/prom', (req, res) => {
  if (req.header('x-internal-secret') !== config().INTERNAL_SECRET) {
    res.status(403).type('text').send('forbidden');
    return;
  }
  const lines: string[] = [
    '# HELP financia_http_requests_total Total HTTP requests received',
    '# TYPE financia_http_requests_total counter',
    `financia_http_requests_total ${counters.http_requests_total}`,
    '# HELP financia_webhook_received_total Webhooks received',
    '# TYPE financia_webhook_received_total counter',
    `financia_webhook_received_total ${counters.webhook_received}`,
    '# HELP financia_agent_calls_total Total agent calls',
    '# TYPE financia_agent_calls_total counter',
    `financia_agent_calls_total ${counters.agent_calls_total}`,
    '# HELP financia_agent_errors_total Total agent errors',
    '# TYPE financia_agent_errors_total counter',
    `financia_agent_errors_total ${counters.agent_errors_total}`,
    '# HELP financia_rate_limited_total Total rate limited requests',
    '# TYPE financia_rate_limited_total counter',
    `financia_rate_limited_total ${counters.rate_limited}`,
    `# uptime_seconds ${process.uptime()}`
  ];
  res.type('text').send(lines.join('\n') + '\n');
});
