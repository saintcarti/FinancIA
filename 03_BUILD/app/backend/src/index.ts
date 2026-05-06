import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { instagramRouter } from './webhooks/instagram.js';
import { whatsappRouter } from './webhooks/whatsapp.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { internalRouter } from './routes/internal.js';
import { startMessageWorker } from './workers/queue.js';

const cfg = config();

if (cfg.SENTRY_DSN) {
  Sentry.init({ dsn: cfg.SENTRY_DSN, tracesSampleRate: 0.1, environment: cfg.NODE_ENV });
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan(cfg.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Webhooks usan raw body — montar ANTES del json parser global
app.use('/webhook/instagram', instagramRouter);
app.use('/webhook/whatsapp', whatsappRouter);

// JSON global para el resto
app.use(express.json({ limit: '1mb' }));

app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/internal', internalRouter);

// Internal health
app.get('/', (_req, res) => res.json({ name: 'financia-chile-api', status: 'ok' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'unhandled error');
  if (cfg.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'something went wrong' } });
});

const port = cfg.PORT;
app.listen(port, () => {
  logger.info({ port, env: cfg.NODE_ENV }, 'server listening');
  startMessageWorker();
  logger.info('message worker started');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'uncaught exception');
  if (cfg.SENTRY_DSN) Sentry.captureException(err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandled rejection');
  process.exit(1);
});
