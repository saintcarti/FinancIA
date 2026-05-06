import express, { type Request, type Response } from 'express';
import {
  verifyZernioSignature,
  replyToConversation,
  setTyping,
  type ZernioMessageReceivedEvent
} from '../lib/zernio.js';
import { processIncomingMessage } from '../services/conversation.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { logger } from '../lib/logger.js';
import { messageQueue } from '../workers/queue.js';

export const zernioRouter = express.Router();

// Webhook único para todos los canales. Zernio entrega IG + WhatsApp + otros con
// la misma estructura: { id, event, message, conversation, account, timestamp }.
zernioRouter.use(express.raw({ type: 'application/json' }));

zernioRouter.post('/', async (req: Request, res: Response) => {
  const sig = req.header('X-Zernio-Signature') ?? req.header('X-Late-Signature');
  const eventId = req.header('X-Zernio-Event-Id');
  const raw = req.body as Buffer;

  if (!verifyZernioSignature(raw, sig)) {
    logger.warn({ ip: req.ip }, 'invalid zernio signature');
    res.sendStatus(401);
    return;
  }

  let payload: { event?: string } & Partial<ZernioMessageReceivedEvent>;
  try {
    payload = JSON.parse(raw.toString('utf-8'));
  } catch {
    res.sendStatus(400);
    return;
  }

  // Zernio espera 2xx en < 5s. Respondemos inmediato y procesamos async.
  res.sendStatus(200);

  if (payload.event !== 'message.received') {
    logger.debug({ event: payload.event }, 'zernio event ignored');
    return;
  }

  const ev = payload as ZernioMessageReceivedEvent;
  const text = ev.message?.text?.trim();
  if (!text) return;

  const platform = ev.account.platform;
  if (platform !== 'instagram' && platform !== 'whatsapp') {
    logger.info({ platform }, 'platform not handled in Q1');
    return;
  }

  try {
    await messageQueue.add(
      'incoming',
      {
        channel: platform,
        conversationId: ev.conversation.id,
        externalUserId: ev.message.sender?.id ?? ev.conversation.id,
        zernioEventId: eventId ?? ev.id,
        text,
        timestamp: new Date(ev.timestamp).getTime() || Date.now()
      },
      {
        jobId: `zernio:${ev.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
      }
    );
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'failed to enqueue zernio job');
  }
});

/** Handler que el worker invoca por job. */
export async function handleZernioMessage(data: {
  channel: 'instagram' | 'whatsapp';
  conversationId: string;
  externalUserId: string;
  zernioEventId: string;
  text: string;
  timestamp: number;
}): Promise<void> {
  const rl = await checkRateLimit(data.externalUserId);
  if (!rl.ok) {
    await replyToConversation(
      data.conversationId,
      'Tomemos un break breve — has alcanzado el límite diario gratuito de mensajes. Conversamos mañana 🙌'
    );
    return;
  }

  await setTyping(data.conversationId);

  const result = await processIncomingMessage({
    channel: data.channel,
    externalUserId: data.externalUserId,
    metaMessageId: data.zernioEventId,
    text: data.text,
    timestamp: data.timestamp,
    conversationProviderId: data.conversationId
  });

  if (result.bot_paused) {
    logger.info({ user: data.externalUserId }, 'bot paused, skipping reply');
    return;
  }
  if (!result.reply) return;

  await replyToConversation(data.conversationId, result.reply);
}
