# TECH DECISIONS (ADR log) — FinancIA Chile

## ADR-001: Monolito modular en lugar de microservicios
**Status:** Accepted (2026-05-06)
**Context:** Equipo 1-2 personas. Velocidad Q1 > escalabilidad teórica.
**Decision:** Backend monolítico con módulos bien delimitados (`services/`, `agents/`, `workers/`).
**Consequences:** Deploys más simples (1 repo, 1 servicio Railway). Cuando equipo > 3 personas o un módulo necesita escalado distinto, extraer a service separado. Riesgo: acumular deuda si crecemos rápido.

## ADR-002: Node.js + TypeScript (no Python)
**Status:** Accepted
**Context:** Stack QUANT24 dominante en JS/TS. Webhooks Meta tienen mejor SDK en JS. Anthropic SDK es paritario.
**Decision:** Backend en Node 20 + TypeScript estricto.
**Consequences:** Pierdo madurez del ecosistema ML de Python (no nos pega — usamos APIs externas). Gano: lenguaje único frontend+backend, type-sharing nativo, dev velocity.

## ADR-003: Supabase como única base
**Status:** Accepted
**Context:** Necesitamos Postgres + Auth + Storage + Vector DB.
**Decision:** Supabase cubre los 4 con free tier serio. pgvector ahorra tener Pinecone separado.
**Consequences:** Lock-in moderado (PG es estándar). Si superamos 500MB DB → upgrade a Pro $25/mes. Si vector workload supera ~1M embeddings → reevaluar Pinecone.

## ADR-004: Routing Haiku/Sonnet por complejidad
**Status:** Accepted
**Context:** 90% de preguntas son simples (qué es UF, cuál es la TPM, dónde reclamar). 10% requieren razonamiento (interpretar contrato, comparar opciones).
**Decision:** Clasificador barato (Haiku 200 tokens) decide. Por default Haiku. Escalación a Sonnet si:
- Usuario adjunta imagen/contrato
- Pregunta involucra comparación entre 3+ opciones
- Pregunta menciona "asesoría", "qué me conviene", "cuánto debería"
**Consequences:** Costo promedio cae a ~$0.004/conversación. Riesgo: clasificador equivoca → respuesta pobre. Mitigación: si Haiku produce respuesta < 50 tokens o "no sé", auto-escala a Sonnet con un retry.

## ADR-005: pgvector con hybrid search (BM25 + semantic)
**Status:** Accepted
**Context:** Regulación financiera tiene términos técnicos exactos (CAE, TIR, UF) que importan match léxico. Pero también queries en lenguaje natural.
**Decision:** Top-k=10 hybrid (5 semantic + 5 BM25), re-rank con Cohere rerank-multilingual o Voyage rerank si presupuesto permite. Q1: re-rank con cross-encoder local (MiniLM).
**Consequences:** Latencia +200ms vs semantic-only. Calidad de retrieval +30% en términos técnicos.

## ADR-006: Prompt caching agresivo
**Status:** Accepted
**Context:** System prompt + retrieval context = ~2.5K tokens estables por sesión.
**Decision:** Cache 4 segmentos: system_prompt, regulatory_context, conversation_summary, user_memory.
**Consequences:** ~70% input cost reduction. Cache TTL Anthropic = 5 min, suficiente para sesión típica.

## ADR-007: Disclaimer auto-injected (no opt-in)
**Status:** Accepted (regulatorio + ético)
**Context:** Riesgo legal si parecemos asesoría financiera.
**Decision:** Footer auto-añadido server-side a CADA mensaje saliente:
> "📌 Esto es información educativa basada en datos públicos de la CMF. No constituye asesoría financiera ni recomendación de inversión. Para decisiones consulta a un asesor certificado. Fuentes citadas: [link]"
**Consequences:** Mensajes ~50 tokens más largos. Imposible que el bot olvide el disclaimer (no depende del modelo, depende del wrapper).

## ADR-008: n8n self-hosted en Railway
**Status:** Accepted
**Context:** Workflows visuales para no-devs (futuro), credenciales centralizadas.
**Decision:** n8n self-host en Railway $5/mes. Workflows versionados en `/n8n-workflows/*.json`.
**Consequences:** Backup manual de workflows en git. Si Railway cae, workflows se recuperan via import JSON.

## ADR-009: Zernio para Instagram + WhatsApp (no Meta directo, no Twilio)
**Status:** Accepted (revisado 2026-05-06)
**Context:** Setup directo con Meta requiere developer app + business verification (2-14 días) + token rotation cada 60 días + 6+ env vars distintos. Para un hackathon con plazo de 48h, es bloqueador.
**Decision:** Usar Zernio como capa de abstracción. 1 API key (`ZERNIO_API_KEY`) + 1 webhook secret (`ZERNIO_WEBHOOK_SECRET`). Conexión via Embedded Signup desde el dashboard.
**Consequences:**
- ✅ Time-to-first-message: minutos en vez de días
- ✅ Misma API para Instagram DM y WhatsApp (`POST /v1/inbox/conversations/:id/messages`)
- ✅ Token rotation gestionado por Zernio
- ⚠️ Dependencia de proveedor adicional (Zernio puede caer)
- ⚠️ Costo: plataforma fee de Zernio + Meta fee per-message (revisar pricing)
- ⚠️ Reels publish menos documentado en Zernio que en Meta directo — validar en deploy

**Migración a Meta directo:** posible en Q2 si volumen lo justifica. La capa `lib/zernio.ts` aísla la integración.

## ADR-010: Generación de Reels: TTS + ffmpeg, no Runway/Sora
**Status:** Accepted (Q1)
**Context:** Costo y velocidad. Un Reel "talking head" generado por Sora cuesta $20 y 5 min. Un Reel con voiceover + waveform + texto cuesta $0.05 y 30 segundos.
**Decision:** Pipeline ffmpeg: TTS audio + cover image + waveform + brand bumper.
**Consequences:** Reels visualmente "tipo podcast clip", no avatar. Se ven profesionales y honestos. Q2 explorar avatar Synthesia.

## ADR-011: Idempotencia de webhooks
**Status:** Accepted
**Context:** Meta reintenta webhooks ante 5xx. Procesar 2 veces = bot responde 2 veces.
**Decision:** Cada mensaje Meta tiene `mid` (message id). Tabla `processed_webhooks (mid PK, processed_at)`. Antes de procesar, INSERT `mid` con ON CONFLICT DO NOTHING. Si conflict → ya procesado, ignore.
**Consequences:** Tabla crece (TTL 30 días con cron de cleanup). Garantiza exactly-once a nivel mensaje.

## ADR-012: No almacenar contenido sensible PII más de 90 días
**Status:** Accepted
**Context:** Privacidad + GDPR-like + Ley 19.628 Chile.
**Decision:** Retention 90 días en `messages.content`. Después, retain solo metadata (user_id hash, topic, satisfaction, no contenido).
**Consequences:** Cron mensual `purge_old_messages.ts`. Pierde historial profundo, gana cumplimiento.

## ADR-013: Tool use con schema estricto
**Status:** Accepted
**Context:** Agente debe poder llamar `verify_entity(name)`, `compare_rates(product, amount, term)`, `generate_complaint_guide(institution, issue)`.
**Decision:** Definir tools en JSON Schema. Backend valida output del modelo antes de ejecutar (zod).
**Consequences:** Si modelo alucina parámetros → falla validación → re-prompt con error message → max 2 retries → fallback "no pude verificar, te paso link CMF".

## ADR-014: Rate limit en Redis sliding window
**Status:** Accepted
**Context:** Abuso individual o bot scraping = costos descontrolados.
**Decision:** Sliding window: 20 conversaciones/día/usuario, 5/hora. Implementación Redis (`SETEX` + `ZRANGEBYSCORE`).
**Consequences:** Usuario muy activo se topa con "tomemos un break, conversamos en X horas". Mensaje empático, no técnico.

## ADR-015: Observabilidad mínima viable
**Status:** Accepted
**Context:** No tenemos SRE, pero necesitamos saber cuándo algo se rompe.
**Decision:**
- Sentry frontend + backend (errors)
- Vercel Analytics (frontend perf)
- Railway logs (backend)
- Custom: cost log a Supabase tabla `claude_calls` por cada llamada (model, input_tokens, output_tokens, cost_usd, latency_ms)
**Consequences:** Dashboard admin lee de `claude_calls` para gráficas de costo. Si Anthropic factura > Supabase log → alerta drift.
