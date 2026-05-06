import type { Request, Response } from 'express';
import express from 'express';
import { verifyMetaSignature, sendWhatsAppMessage } from '../lib/meta.js';
import { processIncomingMessage } from '../services/conversation.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { messageQueue } from '../workers/queue.js';

export const whatsappRouter = express.Router();
whatsappRouter.use(express.raw({ type: 'application/json' }));

whatsappRouter.get('/', (req: Request, res: Response) => {
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

whatsappRouter.post('/', async (req: Request, res: Response) => {
  const sig = req.header('X-Hub-Signature-256');
  const raw = req.body as Buffer;

  if (!verifyMetaSignature(raw, sig)) {
    logger.warn({ ip: req.ip }, 'invalid WA signature');
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

  res.sendStatus(200);

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;
        for (const m of value.messages) {
          if (m.type !== 'text') continue;
          await messageQueue.add(
            'incoming',
            {
              channel: 'whatsapp',
              externalUserId: m.from,
              metaMessageId: m.id,
              text: m.text.body,
              timestamp: parseInt(m.timestamp, 10) * 1000
            },
            { jobId: `wa:${m.id}`, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
          );
        }
      }
    }
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'WA webhook processing failed');
  }
});

export async function handleWhatsAppMessage(data: {
  externalUserId: string;
  metaMessageId: string;
  text: string;
  timestamp: number;
}): Promise<void> {
  const rl = await checkRateLimit(data.externalUserId);
  if (!rl.ok) {
    await sendWhatsAppMessage(
      data.externalUserId,
      'Tomemos un break breve — has alcanzado el límite diario. Conversamos mañana 🙌'
    );
    return;
  }

  const result = await processIncomingMessage({
    channel: 'whatsapp',
    externalUserId: data.externalUserId,
    metaMessageId: data.metaMessageId,
    text: data.text,
    timestamp: data.timestamp
  });

  if (result.bot_paused || !result.reply) return;
  await sendWhatsAppMessage(data.externalUserId, result.reply);
}
