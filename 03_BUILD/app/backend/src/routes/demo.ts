/**
 * DEMO MODE — endpoint para testear el agente sin necesidad de Zernio o webhook real.
 *
 * Útil cuando:
 * - No tienes Zernio aún configurado
 * - Quieres probar prompts en pipeline real (RAG + tools + guardrails)
 * - Quieres correr eval suite contra producción
 *
 * NO usar en producción para usuarios finales (sin rate limit por user real,
 * sin disclaimer de canal, sin canal de respuesta) — solo para test interno.
 *
 * Auth: requiere `INTERNAL_SECRET` en header `x-internal-secret`.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { runQA } from '../agents/qa.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { supabase } from '../lib/supabase.js';
import type Anthropic from '@anthropic-ai/sdk';

export const demoRouter = Router();

function requireInternal(req: Request, res: Response, next: NextFunction): void {
  if (req.header('x-internal-secret') !== config().INTERNAL_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.string().uuid().optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .optional(),
  conversation_summary: z.string().max(2000).optional()
});

/**
 * POST /api/demo/chat
 * Body: { message, conversation_id?, history?, conversation_summary? }
 * Response: { reply, cost_usd, model_used, tool_calls_made, rag_top_score, latency_ms, iterations }
 */
demoRouter.post('/chat', requireInternal, async (req, res) => {
  const t0 = Date.now();
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const fakeConvId =
    parsed.data.conversation_id ?? '00000000-0000-0000-0000-000000000000';
  const recentHistory: Anthropic.MessageParam[] = (parsed.data.history ?? []).map((m) => ({
    role: m.role,
    content: m.content
  }));

  try {
    const result = await runQA({
      conversationId: fakeConvId,
      userMessage: parsed.data.message,
      conversationSummary: parsed.data.conversation_summary,
      recentHistory
    });
    res.json({
      reply: result.text,
      cost_usd: result.cost_usd,
      model_used: result.model_used,
      tool_calls_made: result.tool_calls_made,
      rag_top_score: result.rag_top_score,
      iterations: result.iterations,
      latency_ms: Date.now() - t0
    });
  } catch (e) {
    logger.error({ err: (e as Error).message, stack: (e as Error).stack }, 'demo chat failed');
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/demo/conversation
 * Body: { messages: [{role, content}, ...] }
 * Ejecuta toda la conversación turno por turno y devuelve el log completo.
 * Útil para eval suite con flows multi-turno.
 */
const ConvSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .min(1)
    .max(20)
});

demoRouter.post('/conversation', requireInternal, async (req, res) => {
  const parsed = ConvSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const log: Array<{ role: string; content: string; meta?: unknown }> = [];
  const history: Anthropic.MessageParam[] = [];
  let totalCost = 0;

  for (const turn of parsed.data.messages) {
    if (turn.role === 'user') {
      const result = await runQA({
        conversationId: '00000000-0000-0000-0000-000000000000',
        userMessage: turn.content,
        recentHistory: [...history]
      });
      log.push({ role: 'user', content: turn.content });
      log.push({
        role: 'assistant',
        content: result.text,
        meta: {
          cost_usd: result.cost_usd,
          model: result.model_used,
          rag_top_score: result.rag_top_score,
          tool_calls: result.tool_calls_made
        }
      });
      history.push({ role: 'user', content: turn.content });
      history.push({ role: 'assistant', content: result.text });
      totalCost += result.cost_usd;
    } else {
      // role === 'assistant' (provided context, e.g., for testing follow-ups)
      log.push({ role: 'assistant', content: turn.content });
      history.push({ role: 'assistant', content: turn.content });
    }
  }
  res.json({ log, total_cost_usd: Number(totalCost.toFixed(6)) });
});

/** Status de capacidades del demo (corpus indexado, modelos disponibles). */
demoRouter.get('/status', requireInternal, async (_req, res) => {
  const sb = supabase();
  const { count: regs } = await sb.from('regulations').select('*', { head: true, count: 'exact' });
  const { count: chunks } = await sb.from('embeddings').select('*', { head: true, count: 'exact' });
  res.json({
    regulations_count: regs ?? 0,
    embeddings_count: chunks ?? 0,
    models: { haiku: config().HAIKU_MODEL, sonnet: config().SONNET_MODEL },
    embedding_model: config().EMBEDDING_MODEL,
    ready: (regs ?? 0) > 0 && (chunks ?? 0) > 0
  });
});
