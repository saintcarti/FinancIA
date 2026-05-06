# DECISIONS — log autónomo del pipeline

Decisiones tomadas durante la construcción 5h sin confirmación del founder. Cada una documentada con razón.

## D-001 — Stack: Node + TS, no Python
**Decisión:** Backend en Node.js + TypeScript (no FastAPI/Python).
**Razón:** Stack QUANT24 dominante en JS. Anthropic SDK paritario. Type-sharing nativo con frontend.
**Impacto:** Documentado en `02_ARCHITECTURE/TECH_DECISIONS.md` ADR-002.

## D-002 — Monolito en lugar de microservicios
**Decisión:** Backend monolítico modular.
**Razón:** Equipo 1-2 personas, velocidad Q1.
**Cuándo revisar:** equipo > 3 devs.

## D-003 — Embeddings: Google text-embedding-004 (no Voyage, no OpenAI)
**Decisión:** Google text-embedding-004 (768 dim).
**Razón:** Free tier serio (1500 RPM), calidad ~ Voyage en español, no añade un proveedor más.
**Tradeoff:** menor performance que Voyage en algunos benchmarks; aceptable para Q1.

## D-004 — Vector DB: pgvector (no Pinecone, no Qdrant)
**Decisión:** pgvector dentro de Supabase.
**Razón:** 1 base de datos en vez de 2; ahorra credenciales, latencia, costo.
**Cuándo revisar:** > 1M vectores o latencia p95 > 500ms en retrieval.

## D-005 — Routing Haiku/Sonnet 90/10
**Decisión:** Default Haiku, escala Sonnet con 4 reglas (imagen, comparación, longitud > 500, "qué me conviene").
**Razón:** Costo ~$0.004/conv vs ~$0.01 si todo fuera Sonnet.
**Riesgo aceptado:** clasificador puede equivocarse en 5% de casos. Mitigación: si Haiku produce respuesta < 50 tokens o "no sé", auto-escala.

## D-006 — Disclaimer auto-injected server-side
**Decisión:** Footer regulatorio se añade en `applyDisclaimer()` (en `guardrails.ts`), no en el system prompt.
**Razón:** Evita que el modelo "olvide" el disclaimer en respuestas largas o atípicas. Garantía 100%.

## D-007 — Hybrid search 60% semantic + 40% BM25
**Decisión:** Función SQL `hybrid_search` con weights fijos.
**Razón:** Términos técnicos regulatorios (CAE, UF) se capturan mejor con BM25; lenguaje natural con semantic. Fusión balanceada.
**Iteración:** ajustar pesos tras eval set inicial.

## D-008 — TMC (tasa máxima convencional) hardcodeada como tabla
**Decisión:** En `cmf.ts → getMaxConventionalRate`, tabla referencial 2026.
**Razón:** Endpoint oficial CMF requiere autenticación que no tenemos en MVP. La tabla es indicativa, suficiente para ilustrar al usuario.
**A reemplazar Q2:** integración real con CMF.

## D-009 — Retención mensajes 90 días
**Decisión:** Borrar contenido de `messages.content` después de 90 días, retener solo metadata.
**Razón:** Cumplimiento Ley 19.628 + minimización de PII.
**Implementación:** cron pg_cron mensual (configurar manual en Supabase tras deploy).

## D-010 — Idempotencia webhooks vía tabla
**Decisión:** Tabla `processed_webhooks` con UNIQUE en `meta_message_id`.
**Razón:** Meta retry agresivo; evitar respuestas duplicadas. ON CONFLICT DO NOTHING garantiza exactly-once.

## D-011 — Rate limit 20/día + 5/hora
**Decisión:** Sliding window Redis.
**Razón:** Suficiente para uso real (la mayoría usa < 5/día). Bloquea abuso económico.
**Configurable:** vía env vars.

## D-012 — TTS: ElevenLabs free, no Google Cloud TTS
**Decisión:** ElevenLabs free tier (10K chars/mes ≈ 30 Reels de 60s).
**Razón:** Voces más naturales para español chileno. Google TTS robotic. Costo $0 hasta exceso.
**Tradeoff:** dependencia de free tier; si excedemos, ~$5/mes a starter.

## D-013 — Generación de Reels: ffmpeg + waveform + cover image
**Decisión:** No usar Sora/Runway (avatar realista) en Q1.
**Razón:** Costo ($20/Reel vs $0.05) y velocidad (5 min vs 30s). Estilo "podcast clip" se ve profesional y honesto.
**Q2:** explorar avatar con Synthesia.

## D-014 — Admin dashboard: Next.js sí, mobile no
**Decisión:** Solo desktop, sin app móvil del admin.
**Razón:** El operador (founder) trabaja en desktop. Mobile responsive es suficiente. La app del usuario final es Instagram/WhatsApp, no nuestra.

## D-015 — Auth admin: magic link, no password
**Decisión:** Supabase Auth con magic links.
**Razón:** Menos superficie de ataque, no hay password management, UX simple.

## D-016 — n8n self-hosted en Railway
**Decisión:** No usar n8n cloud ($20+/mes), self-host en Railway ($5/mes).
**Razón:** Costo 4× menor. Workflows versionados en git como JSON.

## D-017 — Email founder en `admin_emails` tabla
**Decisión:** Pre-poblar `b.calderan2008@gmail.com` en migración inicial.
**Razón:** Acceso inmediato post-deploy sin paso adicional. Cualquier nuevo admin se agrega vía SQL manual.

## D-018 — Logs PII redaction
**Decisión:** `redact()` aplicado en pino formatter, RUT/email/teléfono/cuenta.
**Razón:** Privacy by default. Aunque Sentry retiene 90 días, no debe haber PII en breadcrumbs.

## D-019 — Tests: 4 archivos críticos (no full coverage)
**Decisión:** Tests para guardrails, HMAC verify, classifier heurísticas, executeTool. Coverage threshold 60%.
**Razón:** En 5h no hay tiempo para 100% coverage. Foco en lógica que rompe en producción si falla.

## D-020 — Sin web embed para terceros (Q1)
**Decisión:** El bot solo vive en IG/WhatsApp. No exponer chat web embed.
**Razón:** Foco GTM en canales nativos. Embed agrega scope sin validación. Q3 si hay demanda.

## D-021 — Ingesta inicial: 10 documentos hardcoded en seed
**Decisión:** `scripts/ingest-cmf.ts` viene con corpus mínimo viable inline.
**Razón:** Permite que el sistema funcione end-to-end sin depender de scraping CMF externo en lanzamiento. Re-ingest semanal complementa.

## D-022 — Pricing tabla en código (Q2 dinámico)
**Decisión:** Pricing Anthropic en `anthropic.ts` PRICING constant.
**Razón:** Anthropic no expone API de pricing. Si cambian precios, actualizar código y rebuild. Documentar en CHANGELOG.

## D-023 — Disclaimer en español, no inglés
**Decisión:** Solo español Chile en Q1.
**Razón:** Audiencia exclusivamente chilena. Multi-idioma es complejidad sin valor inmediato.

## D-024 — No video generativo del bot (avatar) en Q1
**Decisión:** Reels son audio + cover + waveform.
**Razón:** ver D-013.

## D-025 — Webhooks IG y WhatsApp en handlers separados
**Decisión:** Carpetas `webhooks/instagram.ts` y `webhooks/whatsapp.ts` distintas, aunque comparten lógica.
**Razón:** Meta puede cambiar formato de uno sin el otro. Modularidad permite evolución independiente.
