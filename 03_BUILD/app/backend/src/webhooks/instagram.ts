import type { Request, Response } from 'express';
import express from 'express';
import { verifyMetaSignature, sendInstagramMessage, setTypingOn } from '../lib/meta.js';
import { processIncomingMessage } from '../services/conversation.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { messageQueue } from '../workers/queue.js';

export const instagramRouter = express.Router();

// IMPORTANT: este middleware se monta ANTES del JSON parser global,
// porque necesitamos el raw body para HMAC.
instagramRouter.use(express.raw({ type: 'application/json' }));

instagramRouter.get('/', (req: Request, res: Response) => {
  const cfg = config();
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === cfg.META_VERIFY_TOKEN
  ) {
    res.status(200).send(req.query['hub.challenge']);
    return;
  }
  res.sendStatus(403);
});

instagramRouter.post('/', async (req: Request, res: Response) => {
  const sig = req.header('X-Hub-Signature-256');
  const raw = req.body as Buffer;

  if (!verifyMetaSignature(raw, sig)) {
    logger.warn({ ip: req.ip }, 'invalid IG signature');
    res.sendStatus(401);
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(raw.toString('utf-8'));
  } catch {
    res.sendStatus(400);
    return;
  }

  // Responder 200 inmediato, procesar async
  res.sendStatus(200);

  try {
    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (!event.message?.text) continue;
        if (event.message?.is_echo) continue;
        const senderId = event.sender?.id;
        const mid = event.message?.mid;
        if (!senderId || !mid) continue;

        await messageQueue.add(
          'incoming',
          {
            channel: 'instagram',
            externalUserId: senderId,
            metaMessageId: mid,
            text: event.message.text,
            timestamp: event.timestamp ?? Date.now()
          },
          { jobId: `ig:${mid}`, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
        );
      }
    }
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'IG webhook processing failed');
  }
});

/** Handler que el worker invoca para cada job. */
export async function handleInstagramMessage(data: {
  externalUserId: string;
  metaMessageId: string;
  text: string;
  timestamp: number;
}): Promise<void> {
  const rl = await checkRateLimit(data.externalUserId);
  if (!rl.ok) {
    await sendInstagramMessage(
      data.externalUserId,
      'Tomemos un break breve — has alcanzado el límite diario gratuito de mensajes. ' +
        'Conversamos mañana 🙌'
    );
    return;
  }

  await setTypingOn(data.externalUserId);

  const result = await processIncomingMessage({
    channel: 'instagram',
    externalUserId: data.externalUserId,
    metaMessageId: data.metaMessageId,
    text: data.text,
    timestamp: data.timestamp
  });

  if (result.bot_paused) {
    logger.info({ user: data.externalUserId }, 'bot paused, skipping reply');
    return;
  }
  if (!result.reply) return;

  await sendInstagramMessage(data.externalUserId, result.reply);
}
