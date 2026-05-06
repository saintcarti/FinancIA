/**
 * GENERATE REEL — pipeline end-to-end de generación de Reel diario.
 *
 * Pasos:
 *  1. Lee indicadores CMF (UF, IPC, TPM, dólar)
 *  2. Lee últimos topics preguntados (para variar contenido)
 *  3. Llama Sonnet con system prompt video_script para generar el guión
 *  4. Valida estructura JSON estricta
 *  5. Persiste en `videos` (sin asset_url ni ig_media_id por ahora)
 *  6. Devuelve el script y caption listos para TTS+ffmpeg+publish
 *
 * Uso:
 *   npm run generate-reel             (corre todo, NO publica)
 *   npm run generate-reel -- --publish (intenta publicar via Zernio si tienes ZERNIO_IG_ACCOUNT_ID)
 *   npm run generate-reel -- --dry    (solo simula, no escribe a DB)
 */
import { call, extractText } from '../src/lib/anthropic.js';
import { config } from '../src/config.js';
import { supabase } from '../src/lib/supabase.js';
import { getUF, getIPC, getTPM, getDolar } from '../src/lib/cmf.js';
import { prompt } from '../src/agents/prompts.js';
import { logger } from '../src/lib/logger.js';

interface ReelScript {
  topic: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  hashtags: string[];
}

function safeJson(text: string): unknown {
  // Sonnet a veces envuelve en ```json ... ``` o agrega texto previo
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model output');
  return JSON.parse(match[0]);
}

function validate(j: unknown): ReelScript {
  if (!j || typeof j !== 'object') throw new Error('not an object');
  const o = j as Partial<ReelScript>;
  for (const k of ['topic', 'hook', 'body', 'cta', 'caption'] as const) {
    if (!o[k] || typeof o[k] !== 'string') throw new Error(`missing field: ${k}`);
  }
  if (!Array.isArray(o.hashtags)) throw new Error('hashtags must be array');
  if (o.hook!.split(/\s+/).length > 12) throw new Error('hook too long (>12 words)');
  if (o.body!.split(/\s+/).length > 200) throw new Error('body too long (>200 words)');
  return o as ReelScript;
}

async function fetchIndicators(): Promise<Record<string, unknown>> {
  const [uf, ipc, tpm, dolar] = await Promise.allSettled([getUF(), getIPC(), getTPM(), getDolar()]);
  return {
    uf: uf.status === 'fulfilled' ? uf.value : null,
    ipc: ipc.status === 'fulfilled' ? ipc.value : null,
    tpm: tpm.status === 'fulfilled' ? tpm.value : null,
    dolar: dolar.status === 'fulfilled' ? dolar.value : null
  };
}

async function getRecentTopics(limit = 5): Promise<string[]> {
  const sb = supabase();
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data } = await sb
    .from('videos')
    .select('topic')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((d: any) => d.topic).filter(Boolean);
}

async function getTopUserTopics(limit = 5): Promise<string[]> {
  const sb = supabase();
  const { data } = await sb.rpc('get_top_topics', { days_back: 7, top_n: limit });
  return ((data ?? []) as Array<{ topic: string }>).map((d) => d.topic);
}

async function main(): Promise<void> {
  const isDry = process.argv.includes('--dry');
  const shouldPublish = process.argv.includes('--publish');

  logger.info({ dry: isDry, publish: shouldPublish }, 'starting reel generation');

  const indicators = await fetchIndicators();
  const recentTopics = await getRecentTopics();
  const topUserTopics = await getTopUserTopics();

  const userPrompt = `Datos del día:
- UF: ${indicators.uf ? (indicators.uf as any).value + ' (' + (indicators.uf as any).date + ')' : 'no disponible'}
- IPC último: ${indicators.ipc ? (indicators.ipc as any).value + '%' : 'no disponible'}
- TPM vigente: ${indicators.tpm ? (indicators.tpm as any).value + '%' : 'no disponible'}
- Dólar observado: ${indicators.dolar ? '$' + (indicators.dolar as any).value : 'no disponible'}

Últimos 5 topics que cubrimos (NO repitas):
${recentTopics.length ? recentTopics.map((t) => '- ' + t).join('\n') : '- (ninguno)'}

Top 5 temas que la audiencia preguntó esta semana (PRIORIZA cubrir alguno):
${topUserTopics.length ? topUserTopics.map((t) => '- ' + t).join('\n') : '- (sin datos)'}

Genera el script del Reel de hoy. Devuelve ÚNICAMENTE JSON válido.`;

  const t0 = Date.now();
  const r = await call({
    model: config().SONNET_MODEL as 'claude-sonnet-4-6',
    purpose: 'video_script',
    max_tokens: 1500,
    temperature: 0.7,
    system: prompt('system_video_script'),
    messages: [{ role: 'user', content: userPrompt }]
  });
  const text = extractText(r.response);
  const ms = Date.now() - t0;

  let parsed: ReelScript;
  try {
    parsed = validate(safeJson(text));
  } catch (e) {
    logger.error({ err: (e as Error).message, raw: text.slice(0, 500) }, 'script validation failed');
    process.exit(1);
  }

  const fullCaption = `${parsed.caption}\n\n${parsed.hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}`;

  console.log('\n══════════════ REEL GENERATED ══════════════');
  console.log(`Topic:    ${parsed.topic}`);
  console.log(`Hook:     "${parsed.hook}"`);
  console.log(`Body:     ${parsed.body.slice(0, 200)}${parsed.body.length > 200 ? '...' : ''}`);
  console.log(`CTA:      "${parsed.cta}"`);
  console.log(`Hashtags: ${parsed.hashtags.join(' ')}`);
  console.log(`Cost:     $${r.cost_usd.toFixed(5)}`);
  console.log(`Latency:  ${ms}ms`);
  console.log('═══════════════════════════════════════════\n');

  if (isDry) {
    console.log('DRY mode — nada persistido.');
    process.exit(0);
  }

  // Persist en DB
  const { data: video, error } = await supabase()
    .from('videos')
    .insert({
      script: parsed.body,
      caption: fullCaption,
      hashtags: parsed.hashtags,
      asset_url: '', // pendiente: TTS + ffmpeg externo
      topic: parsed.topic,
      source_indicators: indicators
    })
    .select('id')
    .single();
  if (error) {
    logger.error({ err: error.message }, 'persist failed');
    process.exit(1);
  }
  console.log(`✅ Persistido: video_id=${video.id}`);
  console.log('\nNext steps (manual o vía workflow n8n):');
  console.log('  1. TTS del audio (ElevenLabs o Google TTS)');
  console.log('  2. ffmpeg compose (cover + waveform + audio)');
  console.log('  3. Upload a Supabase Storage bucket reels-public');
  console.log('  4. Update videos.asset_url con la URL pública');
  console.log('  5. Si --publish: POST /internal/reel/publish con el video_url\n');

  if (shouldPublish) {
    console.log('⚠️  --publish: pendiente integración completa con TTS + ffmpeg.');
    console.log('   Por ahora el script y la caption están listos para que tu workflow n8n los use.');
  }
  process.exit(0);
}

main().catch((e) => {
  logger.fatal({ err: (e as Error).message, stack: (e as Error).stack }, 'reel generation failed');
  process.exit(1);
});
