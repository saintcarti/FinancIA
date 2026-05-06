import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { zernioRouter } from './webhooks/zernio.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { internalRouter } from './routes/internal.js';
import { startMessageWorker } from './workers/queue.js';

const cfg = config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan(cfg.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Webhook Zernio usa raw body — montar ANTES del json parser global
app.use('/webhook/zernio', zernioRouter);

// JSON global para el resto
app.use(express.json({ limit: '1mb' }));

app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/internal', internalRouter);

// Internal health
app.get('/', (_req, res) => res.json({ name: 'financia-chile-api', status: 'ok' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'unhandled error');
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
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandled rejection');
  process.exit(1);
});
