import { Router, type Request, type Response, type NextFunction } from 'express';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { reelQueue, ingestQueue } from '../workers/queue.js';
import { supabase } from '../lib/supabase.js';
import { publishInstagramReel } from '../lib/meta.js';

export const internalRouter = Router();

function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header('x-internal-secret');
  if (provided !== config().INTERNAL_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}
internalRouter.use(requireInternalSecret);

internalRouter.post('/reel/publish', async (req, res) => {
  const { video_path, caption, hashtags, topic, script } = req.body as {
    video_path: string; caption: string; hashtags: string[]; topic: string; script: string;
  };
  try {
    const fullCaption = `${caption}\n\n${(hashtags ?? []).map((h) => '#' + h.replace(/^#/, '')).join(' ')}`;
    // En producción: video_path debería ser una URL pública (Supabase Storage signed URL)
    const result = await publishInstagramReel({ videoUrl: video_path, caption: fullCaption });
    await supabase().from('videos').insert({
      script,
      caption: fullCaption,
      hashtags,
      asset_url: video_path,
      ig_media_id: result.media_id,
      published_at: new Date().toISOString(),
      topic
    });
    res.json({ ok: true, media_id: result.media_id });
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'reel publish failed');
    res.status(500).json({ error: (e as Error).message });
  }
});

internalRouter.post('/regulations/check-new', async (_req, res) => {
  const job = await ingestQueue.add('check-new', {});
  res.json({ job_id: job.id });
});

internalRouter.post('/embeddings/reembed-all', async (_req, res) => {
  const job = await ingestQueue.add('reembed-all', {});
  res.json({ job_id: job.id });
});

internalRouter.post('/comment/handle', async (_req, res) => {
  // TODO Q1.5 — handler de Instagram comment
  res.json({ ok: true });
});
