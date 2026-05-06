# N8N WORKFLOWS — FinancIA Chile

4 workflows críticos. Todos versionados como JSON exportables en `03_BUILD/n8n-workflows/`.

---

## 1. `daily_reel.json` — Reel diario autónomo

**Trigger:** Cron 09:00 CLT (12:00 UTC)
**Objetivo:** Publicar 1 Reel educativo nuevo cada día.

```
[Cron 09:00 CLT]
  ↓
[HTTP Request → CMF API: get UF, IPC, TPM hoy]
  ↓
[HTTP Request → CMF API: list normativa últimas 48h]
  ↓
[Function: build context] → input para Sonnet
  ↓
[HTTP → Anthropic Sonnet 4.6]
  prompt: "Genera script para Reel 60s educativo basado en estos datos..."
  output: { hook, body, cta, caption, hashtags[] }
  ↓
[Validate JSON Schema] → reject si falta campo
  ↓
[HTTP → ElevenLabs TTS]
  voice: "es-CL female warm"
  text: hook + body + cta
  output: audio.mp3
  ↓
[Execute Command: ffmpeg]
  inputs: audio.mp3 + cover.png + waveform.gif + bumper.mp4
  output: reel_YYYYMMDD.mp4 (1080x1920, 60s, h264)
  ↓
[Supabase Storage: upload reel]
  bucket: 'reels-public'
  ↓
[HTTP → Meta Graph API]
  POST /{ig-user-id}/media
  body: { media_type: "REELS", video_url, caption, share_to_feed: true }
  → returns container_id
  ↓
[Wait 30s → poll status until FINISHED]
  ↓
[HTTP → Meta Graph API]
  POST /{ig-user-id}/media_publish
  body: { creation_id: container_id }
  ↓
[Supabase: insert into videos table]
  { script, caption, asset_url, ig_media_id, published_at }
  ↓
[Schedule trigger: metrics_collector in 24h]
```

**Manejo de errores:**
- Si Sonnet falla → reintentar 3 veces con prompt más estricto
- Si ffmpeg falla → notify operador via email, skip del día
- Si Meta falla → reintentar 5 min después; si fail 3 veces → archivar para publicación manual

---

## 2. `cmf_normativa_watcher.json` — Re-ingest normativa nueva

**Trigger:** Cron 06:00 CLT diario
**Objetivo:** Detectar nueva normativa CMF e iniciar pipeline de re-ingest.

```
[Cron 06:00 CLT]
  ↓
[HTTP → CMF normativa endpoint]
  GET https://www.cmfchile.cl/portal/principal/613/w3-channel.html (RSS o scrape)
  ↓
[Function: parse + extract list of new docs since last_run]
  ↓
[Supabase: query existing regulation source_urls]
  ↓
[Function: filter to new docs only]
  ↓
[Loop por cada doc nuevo]
  ├─ [HTTP: download PDF]
  ├─ [POST → backend `/internal/regulation/ingest`]
  │     body: { source_url, pdf_buffer }
  │     backend hace: parse → chunk → embed → upsert
  └─ [Wait 2s entre docs (rate limit)]
  ↓
[Slack/Email notify operador]
  "Procesados N nuevas normativas: [titulos]"
```

---

## 3. `weekly_reembed.json` — Re-embedding completo

**Trigger:** Cron Lunes 03:00 CLT
**Objetivo:** Refrescar embeddings de todo el corpus (por si cambió el modelo o hay drift).

```
[Cron Lunes 03:00 CLT]
  ↓
[Supabase: SELECT id, chunk_text FROM embeddings ORDER BY created_at LIMIT 100 OFFSET 0]
  ↓
[Loop con paginación]
  ├─ [HTTP → Google text-embedding-004 batch]
  │     batch size: 100
  ├─ [Supabase: UPDATE embeddings SET embedding = $1, updated_at = NOW()]
  └─ [Wait 1s entre batches]
  ↓
[Email notify: "Re-embed completo, N chunks procesados"]
```

---

## 4. `instagram_comment_responder.json` — Comentarios públicos

**Trigger:** Webhook (Instagram comment)
**Objetivo:** Cuando alguien comenta una pregunta en un Reel, responder con un teaser y invitar a DM (donde sí podemos conversar 1:1).

```
[Webhook: POST /webhook/instagram-comment]
  ↓
[Function: validar HMAC]
  ↓
[Function: detectar si comment es pregunta]
  - usar Haiku 200 tokens: "es esto una pregunta financiera? sí/no"
  ↓
[If sí]
  ├─ [HTTP → Anthropic Haiku]
  │     prompt: "Responde brevemente (máx 30 palabras) e invita a DM"
  │     output: short_reply
  ├─ [HTTP → Meta Graph API]
  │     POST /{comment-id}/replies
  │     body: { message: short_reply + " 👉 Mándame DM y conversamos." }
  ├─ [Supabase: log comment_response]
  └─ [Trigger: send DM auto-greeting al user via Graph API]
  ↓
[If no] → ignore
```

---

## Convenciones

- **Naming:** `{topic}_{verb}.json` minúsculas + underscore
- **Variables sensibles:** referenciadas como `{{ $env.NAME }}` — n8n inyecta desde Railway env
- **Versionado:** cada workflow tiene tag git `n8n-{name}-vX.Y` cuando cambia
- **Backup:** export semanal automático a Supabase Storage `n8n-backups/`
- **Monitoring:** ejecuciones loguean a tabla `n8n_runs` (workflow_id, status, duration_ms, error)

## Activación

Tras importar JSON en n8n UI:
1. Configurar credenciales (Supabase, Anthropic, Meta, ElevenLabs)
2. Activar workflow (toggle en UI)
3. Probar manual con "Execute Workflow"
4. Verificar logs primera ejecución programada
