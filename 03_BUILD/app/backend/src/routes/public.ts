import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { getUF, getIPC, getTPM, getDolar, getEuro, getUTM, verifyEntity } from '../lib/cmf.js';

export const publicRouter = Router();

publicRouter.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};
  try {
    await supabase().from('app_users').select('id').limit(1);
    checks.db = 'ok';
  } catch { checks.db = 'down'; }
  try {
    await redis().ping();
    checks.redis = 'ok';
  } catch { checks.redis = 'down'; }
  res.json({
    status: Object.values(checks).every((v) => v === 'ok') ? 'ok' : 'degraded',
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '0.1.0',
    checks
  });
});

publicRouter.get('/cmf/uf', async (req, res) => {
  try { res.json(await getUF(req.query.date as string | undefined)); }
  catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
publicRouter.get('/cmf/ipc', async (req, res) => {
  try { res.json(await getIPC(req.query.month as string | undefined)); }
  catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
publicRouter.get('/cmf/tpm', async (_req, res) => {
  try { res.json(await getTPM()); } catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
publicRouter.get('/cmf/dolar', async (req, res) => {
  try { res.json(await getDolar(req.query.date as string | undefined)); }
  catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
publicRouter.get('/cmf/euro', async (req, res) => {
  try { res.json(await getEuro(req.query.date as string | undefined)); }
  catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
publicRouter.get('/cmf/utm', async (req, res) => {
  try { res.json(await getUTM(req.query.month as string | undefined)); }
  catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
publicRouter.get('/cmf/entity', async (req, res) => {
  const name = req.query.name as string | undefined;
  if (!name) return res.status(400).json({ error: 'name required' });
  res.json(await verifyEntity(name));
});
