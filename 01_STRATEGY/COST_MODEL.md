# COST MODEL — FinancIA Chile (operacional)

## Costos fijos mensuales (target Q1)

| Categoría | Servicio | Tier | Costo/mes |
|---|---|---|---|
| Hosting frontend | Vercel | Hobby | $0 |
| Hosting backend | Railway | Trial $5 free | $0 → $20 (post-trial) |
| Hosting n8n | Railway | Self-host | $5 |
| Database | Supabase | Free | $0 → $25 (Pro si > 500MB) |
| Cache | Upstash Redis | Free | $0 |
| Queues | BullMQ on Upstash | — | $0 |
| Monitoring | Sentry | Dev | $0 |
| Domain | financia-chile.cl | NIC Chile | $1.65 |
| Email | Resend | Free 100/día | $0 |
| LLM | Anthropic API | Pay-as-you-go | variable |
| Embeddings | Google AI Studio | Free | $0 |
| TTS | ElevenLabs | Free 10K chars/mes | $0 |
| Meta | Instagram + WhatsApp Cloud API | Free hasta 1000 | $0 |
| **Total fijo Q1** | | | **~$25-50/mes** |

## Costos variables (LLM)

Ver `UNIT_ECONOMICS.md` para detalle. Resumen:
- Costo por conversación: ~$0.004
- Costo por Reel: ~$0.05
- Reels/mes: 30 → ~$1.50

## Escenarios de gasto mensual

### Escenario conservador (Q1 mes 1)
- 100 MAU, 400 conversaciones, 30 Reels
- LLM: $1.68 + $1.50 = $3.18
- Fijo: $25
- **Total: ~$28/mes**

### Escenario base (Q1 mes 3)
- 1.000 MAU, 4.000 conversaciones, 90 Reels acumulados (30/mes)
- LLM: $16.80 + $1.50 = $18.30
- Fijo: $50 (Supabase Pro + Railway)
- **Total: ~$68/mes**

### Escenario optimista (Q2 mes 6)
- 10.000 MAU, 40.000 conversaciones, 30 Reels
- LLM: $168 + $1.50 = $170
- Fijo: $50
- **Total: ~$220/mes**

### Escenario explosivo (Q3 mes 9)
- 100.000 MAU, 400.000 conversaciones, 30 Reels
- LLM: $1.680 + $1.50 = $1.682
- Fijo: $200 (Supabase Team, Railway scale, Sentry Team)
- **Total: ~$1.900/mes**

## Optimizaciones de costo (orden de implementación)

1. **Prompt caching** (día 1) — system prompt + RAG context cacheado, 90% reduction en input cost
2. **Routing Haiku/Sonnet** (día 1) — clasificador barato decide qué modelo usar
3. **Conversation summarization** (semana 2) — comprimir historial > 10 turnos a resumen
4. **Pre-computed FAQ embeddings** (semana 2) — preguntas top 50 con respuesta pre-generada y citada, similarity match antes de llamar Claude
5. **Rate limiting por usuario** (día 1) — máx 20 conversaciones/día/usuario, evita abuso
6. **Cache de UF / IPC en Redis** (día 1) — TTL 1h para indicadores diarios
7. **Embedding batching** (semana 1) — re-ingesta CMF semanal en batch single API call
8. **Compresión de RAG chunks** (mes 2) — descartar chunks irrelevantes con re-ranker barato

## Triggers de alerta
| Métrica | Umbral | Acción |
|---|---|---|
| Costo mensual LLM | > 1.5× presupuesto | Pausar nuevos features, audit de routing |
| Costo / conversación | > $0.05 | Revisión de prompts y caching |
| Tokens output / conversación | > 3.000 | Review de instrucciones (probable verbosidad) |
| Usuario individual > 100 conv/día | sospecha de abuso | Rate limit + flag |

## Presupuesto Q1 total
**< $300 USD/mes** sostenible. Suficiente para 10K MAU con margen.

Si llegamos a 100K MAU = $1.900/mes y aún sin monetizar, abre conversación con CMF / Endeavor para sponsorship o trampa de bridge round.

## Comparación con alternativas
| Solución | Costo equivalente para 10K usuarios |
|---|---|
| Asesor financiero humano (1 por 100 usuarios) | ~$50.000/mes |
| Call center con scripts | ~$15.000/mes |
| ChatGPT Plus para cada usuario | ~$200.000/mes |
| **Nosotros** | **~$220/mes** |

Reducción de costo de 2-3 órdenes de magnitud vs alternativas humanas, manteniendo calidad regulatoria. Esa es la tesis económica.
