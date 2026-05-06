# ARCHITECTURE — FinancIA Chile

## Diagrama lógico (texto)

```
        ┌───────────────────────────────────────────────────┐
        │                  Zernio (proxy unificado)         │
        │  • Conecta Instagram + WhatsApp con 1 API key     │
        │  • Recibe DMs/mensajes, los reenvía a nuestro     │
        │    webhook firmado con HMAC SHA-256               │
        │  • Expone POST /v1/inbox/conversations/:id        │
        │    para responder al hilo                         │
        │  • Maneja Embedded Signup, token rotation,        │
        │    business verification de Meta por nosotros     │
        └────────────────────────┬──────────────────────────┘
                                 │  X-Zernio-Signature
                                 ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Backend Express (Node.js + TypeScript)                    │
   │                                                             │
   │  ┌───────────────┐   ┌──────────────┐   ┌──────────────┐   │
   │  │ Webhook layer │──▶│ Conversation │──▶│ Agent runner │   │
   │  │ HMAC verify   │   │ orchestrator │   │ (Claude)     │   │
   │  └───────────────┘   └──────┬───────┘   └──────┬───────┘   │
   │                             │                  │            │
   │                             ▼                  ▼            │
   │                    ┌─────────────────┐  ┌────────────────┐ │
   │                    │ Memory service  │  │ Tools service  │ │
   │                    │ (last 10 turns) │  │ verify_entity  │ │
   │                    └────────┬────────┘  │ compare_rates  │ │
   │                             │           │ complaint_guide│ │
   │                             ▼           └────────┬───────┘ │
   │                    ┌─────────────────────────────┴───────┐ │
   │                    │ RAG retriever (pgvector + BM25)     │ │
   │                    └────────────────┬────────────────────┘ │
   └─────────────────────────────────────┼────────────────────┬─┘
                                         │                    │
              ┌──────────────────────────┴──┐                 │
              ▼                              ▼                 │
     ┌────────────────┐             ┌─────────────────┐        │
     │ Supabase       │             │ Redis (Upstash) │        │
     │ • Postgres     │             │ • UF/IPC cache  │        │
     │ • pgvector     │             │ • Session state │        │
     │ • Auth (admin) │             │ • Rate limit    │        │
     │ • Storage      │             │ • BullMQ queues │        │
     └────────────────┘             └─────────┬───────┘        │
                                              │                │
                                              ▼                │
                                   ┌─────────────────────┐     │
                                   │ Workers             │     │
                                   │ • Reel generator    │     │
                                   │ • CMF re-ingest     │     │
                                   │ • Embedding batch   │     │
                                   └──────────┬──────────┘     │
                                              │                │
                                              ▼                │
                                   ┌─────────────────────┐     │
                                   │ n8n workflows       │     │
                                   │ • Daily reel cron   │     │
                                   │ • CMF watcher       │     │
                                   └──────────┬──────────┘     │
                                              │                │
                                              ▼                │
                          ┌────────────────────────────────────┘
                          │
                ┌─────────▼────────┐         ┌─────────────────┐
                │ Anthropic API    │         │ CMF API         │
                │ • Haiku 4.5      │         │ • indicadores   │
                │ • Sonnet 4.6     │         │ • instituciones │
                │ • Cache + tools  │         │ • normativa     │
                └──────────────────┘         └─────────────────┘

   ┌──────────────────────────────┐
   │ Admin Dashboard (Next.js)    │
   │ • KPIs                       │
   │ • Conversation viewer        │
   │ • Manual override            │
   │ • Cost monitor               │
   └──────────────┬───────────────┘
                  │  (Supabase Auth)
                  ▼
          Vercel deploy
```

## Componentes principales

### 1. Backend API (`app/backend/`)
- Node.js 20 + Express + TypeScript
- Servidor monolítico modular (suficiente para Q1, micro-servicios prematuros)
- Capas:
  - `webhooks/` — recepción Meta/WhatsApp con HMAC verify
  - `routes/` — REST API admin (Supabase Auth)
  - `services/` — lógica de negocio (conversation, RAG, CMF, tools)
  - `agents/` — wrappers de Claude (Q&A, video script, tool routing)
  - `workers/` — BullMQ consumers (reels, embeddings, ingestion)
  - `lib/` — clientes externos (Supabase, Redis, Anthropic, Meta)

### 2. Frontend Admin (`app/frontend/`)
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Solo para operadores (founder + 1-2 humanos en hand-off)
- Auth: Supabase Auth con email magic link
- 3 pantallas: Dashboard, Conversaciones, Reels

### 3. Database (Supabase Postgres)
- pgvector para embeddings
- RLS habilitado, service role para backend
- Tablas: ver `DB_SCHEMA.sql`

### 4. Cache + Queue (Upstash Redis)
- TTL 1h para indicadores CMF (UF, IPC, TPM)
- Rate limit por usuario (sliding window)
- BullMQ para jobs async (generación de Reels, batch embeddings)

### 5. Content Engine (n8n)
- 4 workflows críticos:
  - `daily_reel.json` — cron 09:00 CLT → CMF data → Sonnet script → TTS → mp4 → Instagram publish
  - `cmf_normativa_watcher.json` — diario 06:00 → check nuevas normativas → ingesta
  - `weekly_reembed.json` — lunes 03:00 → re-embed corpus completo
  - `instagram_comment_responder.json` — webhook → si comentario es pregunta, responde con teaser + invita DM

### 6. Integrations
- **Anthropic SDK** — con prompt caching, tool use, streaming
- **Zernio API** — capa unificada para Instagram DM + WhatsApp Business (reemplaza la integración directa con Meta Graph API). Ver `lib/zernio.ts`.
- **CMF API** — endpoints públicos `https://api.cmfchile.cl/api-sbifv3`

## Decisiones arquitectónicas clave (resumen)

| Decisión | Elección | Razón |
|---|---|---|
| Monolito vs micro-services | Monolito modular | Velocidad Q1, micro-services cuando >3 devs |
| Lenguaje backend | Node.js + TS | Mismo lenguaje frontend, ecosistema Meta/Anthropic SDKs |
| Base de datos | Supabase | pgvector + Auth + Storage en uno, free tier serio |
| Vector DB | pgvector (no Pinecone) | 1 DB en vez de 2; performance suficiente hasta 1M vectores |
| Embeddings | Google text-embedding-004 | Free hasta 1500 RPM; calidad ~ Voyage |
| Async jobs | BullMQ + n8n | BullMQ para in-process; n8n para workflows visuales |
| LLM routing | Haiku default, Sonnet escalation | Costo controlado |
| Hosting | Vercel + Railway | Cero ops, free/low tier suficiente Q1 |
| Auth admin | Supabase magic link | Sin password management |

## Dataflows críticos

### Flow 1: Usuario envía DM en Instagram (vía Zernio)
```
1. Zernio POST /webhook/zernio con event=message.received
   Headers: X-Zernio-Signature (HMAC SHA-256 hex), X-Zernio-Event-Id
   Body: { id, event, message, conversation, account, timestamp }
2. Backend verifica firma con ZERNIO_WEBHOOK_SECRET → reject 401 si falla
3. Detectar account.platform = 'instagram' | 'whatsapp'
4. Extract message.text + conversation.id + sender id
5. Encolar job en BullMQ con jobId=zernio:<eventId> (idempotencia)
6. Responder 200 a Zernio (must be < 5s)
--- worker async ---
7. Rate limit check (Redis sliding window 20/día)
8. Persist user message → Supabase `messages`
9. Guardar provider_conversation_id en `conversations`
10. Load conversation context (últimas 6 turns) + summary
11. Classify complexity (Haiku 200 tokens) → simple | complex
12. RAG retrieval (hybrid pgvector + BM25 → top 5)
13. Call agent (Haiku o Sonnet) con prompt + memory + RAG + tools
14. Si tool call → ejecutar (verify_entity, compare_rates, etc.)
15. Generar respuesta final + footer disclaimer (auto-injected)
16. POST a Zernio /v1/inbox/conversations/:id/messages → reply
17. Persist bot message + cost log → Supabase
18. Async: actualizar conversation summary cada 5 turns
```

### Flow 2: Generación diaria de Reel
```
09:00 CLT cron (n8n)
1. Fetch CMF: UF, IPC, TPM, novedades regulatorias últimas 24h
2. Sonnet: prompt "video script 60s + caption + 5 hashtags + question hook"
3. Validar output (estructura JSON estricta)
4. TTS: ElevenLabs voice "es-CL female warm"
5. Video pipeline: ffmpeg compone (audio + waveform overlay + brand bumper)
6. Upload a Supabase Storage
7. Meta Graph API: POST /{page-id}/media (REELS) + caption
8. Persist: video_id, script, caption, asset_url, metrics_baseline
9. Trigger workflow `metrics_collector` 24h después
```

### Flow 3: Re-ingesta normativa CMF (semanal)
```
Lunes 03:00
1. Scrape CMF normativa endpoint → lista de docs nuevos
2. Por cada doc: fetch PDF → extract texto (pdf-parse)
3. Chunk: 512 tokens, overlap 50, preserve headers
4. Embed batch (Google API, hasta 100 chunks/req)
5. UPSERT a `embeddings` (regulation_id + chunk_index)
6. Update `regulations.last_indexed_at`
7. Notification al admin (email) con resumen
```

## No-funcionales

| Aspecto | Requisito Q1 |
|---|---|
| Latencia respuesta DM | p95 < 8s end-to-end |
| Throughput webhook | 100 RPS sostenidos |
| Disponibilidad | 99.5% mensual |
| RPO | 24h (backup Supabase diario) |
| RTO | < 1h (deploy redo + Supabase restore) |
| Concurrencia conversaciones | 500 usuarios activos simultáneos |

## Decisiones explícitamente diferidas
- 🔜 Multi-tenancy (otros países) → Q2
- 🔜 Mobile app nativa → no en roadmap, Instagram/WhatsApp es la app
- 🔜 Chat web embed para sitios de medios → Q3
- 🔜 Voice (audio in/out por WhatsApp) → Q3
