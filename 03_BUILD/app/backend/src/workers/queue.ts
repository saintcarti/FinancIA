import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const connection = new IORedis(config().REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export const messageQueue = new Queue('messages', { connection });
export const reelQueue = new Queue('reels', { connection });
export const ingestQueue = new Queue('ingest', { connection });

export function startMessageWorker(): Worker {
  const worker = new Worker(
    'messages',
    async (job) => {
      const { channel, externalUserId, metaMessageId, text, timestamp } = job.data as {
        channel: 'instagram' | 'whatsapp';
        externalUserId: string;
        metaMessageId: string;
        text: string;
        timestamp: number;
      };

      const { handleInstagramMessage } = await import('../webhooks/instagram.js');
      const { handleWhatsAppMessage } = await import('../webhooks/whatsapp.js');

      if (channel === 'instagram') {
        await handleInstagramMessage({ externalUserId, metaMessageId, text, timestamp });
      } else {
        await handleWhatsAppMessage({ externalUserId, metaMessageId, text, timestamp });
      }
    },
    { connection, concurrency: 8 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'message job failed');
  });

  return worker;
}

export const events = new QueueEvents('messages', { connection });
events.on('completed', ({ jobId }) => logger.debug({ jobId }, 'message job completed'));
