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
      const { handleZernioMessage } = await import('../webhooks/zernio.js');
      await handleZernioMessage(job.data);
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
