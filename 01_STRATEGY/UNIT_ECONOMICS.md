# UNIT ECONOMICS — FinancIA Chile

## Unidad de análisis
**1 Usuario Activo Mensual (MAU)** = persona que tuvo ≥ 1 conversación útil en el mes.

## Costos por MAU (escenario realista)

### Cálculo de tokens promedio por conversación
- Mensajes promedio por conversación: 6 (3 user, 3 bot)
- Tokens user (input): 60 por mensaje → 180 input tokens
- System prompt + memoria + RAG context: 2.500 tokens (cacheable 90%)
- Tokens bot (output): 200 por mensaje → 600 output tokens

### Routing Haiku/Sonnet
- 90% conversaciones → Haiku 4.5 (suficiente para Q&A reglamentario simple)
- 10% conversaciones → Sonnet 4.6 (verificación + casos sensibles)

### Pricing Anthropic (Q2 2026, precios estables)
| Modelo | Input ($/M) | Output ($/M) | Cache read ($/M) | Cache write ($/M) |
|---|---|---|---|---|
| Haiku 4.5 | $1.00 | $5.00 | $0.10 | $1.25 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 | $3.75 |

### Costo por conversación (con prompt caching)
**Conversación Haiku (90% del tráfico):**
- Cache read 2.250 tokens × $0.10/M = $0.000225
- Input nuevo (250 tokens) × $1.00/M = $0.000250
- Output 600 tokens × $5.00/M = $0.003000
- **Total Haiku: ~$0.0035 / conversación**

**Conversación Sonnet (10% del tráfico):**
- Cache read 2.250 × $0.30/M = $0.000675
- Input nuevo 250 × $3.00/M = $0.000750
- Output 600 × $15.00/M = $0.009000
- **Total Sonnet: ~$0.0104 / conversación**

**Promedio ponderado:**
0.9 × $0.0035 + 0.1 × $0.0104 = **$0.0042 / conversación**

### Conversaciones promedio por MAU
- Adopción inicial: 4 conversaciones/mes/MAU
- Adopción madura: 8 conversaciones/mes/MAU

### Costo Claude / MAU
- Inicial: 4 × $0.0042 = **$0.017 / MAU**
- Maduro: 8 × $0.0042 = **$0.034 / MAU**

### Otros costos por MAU
| Item | Costo/MAU |
|---|---|
| Embeddings Google text-embed-004 (free hasta 1500 RPM) | $0.000 |
| Supabase (free tier hasta 500MB DB + 5GB bandwidth) | $0.000 |
| Redis Upstash (free tier 10K cmds/día) | $0.000 |
| Meta WhatsApp (free hasta 1.000 user-initiated/mes) | $0.000 |
| Vercel + Railway (hobby tier) | $0.000 |
| Sentry (free tier 5K events) | $0.000 |
| **Subtotal infra** | **$0.000** |

### Costos del Content Engine (no por MAU sino por mes)
| Item | Costo/mes |
|---|---|
| 30 Reels × Sonnet (script ~3K tokens) | 30 × $0.05 = $1.50 |
| 30 Reels × TTS (60s @ ElevenLabs free hasta 10K chars) | $0.000 (free tier) |
| 30 Reels × image generation (1 cover image c/u, Recraft free / Flux free) | $0.000 |
| **Subtotal contenido** | **$1.50/mes** |

## Modelo de costo total por mes según escala

| MAU | Conv/mes | Costo Claude | Costo Reels | Costo total | Costo/MAU |
|---|---|---|---|---|---|
| 100 | 400 | $1.68 | $1.50 | **$3.18** | $0.032 |
| 1.000 | 4.000 | $16.80 | $1.50 | **$18.30** | $0.018 |
| 10.000 | 40.000 | $168 | $1.50 | **$169.50** | $0.017 |
| 100.000 | 400.000 | $1.680 | $1.50 | **$1.681** | $0.017 |

## Punto crítico
A 100K MAU, el costo es ~$1.700/mes. Eso es **cero** comparado con el valor educacional. Cada usuario activo que aprende algo regulatorio que no sabía cuesta menos que un café.

## Modelos de monetización futuros (NO Q1)
| Modelo | Cuándo activar | Razón |
|---|---|---|
| **B2B licensing** (banco/fintech licencia el agente) | Q3 si CAC orgánico ≤ $0 | Vender el motor, mantener gratuidad para usuario final |
| **Reportes anonimizados de tendencias regulatorias** (vendidos a CMF, asociaciones) | Q4 | Datos agregados de qué pregunta la gente = oro para reguladores |
| **API educacional** (sitios de medios usan nuestro endpoint) | Q4 | Nuestra capa de traducción como infraestructura |
| **Suscripción premium para temas avanzados** (impuestos, sucesiones, hipotecario complejo) | Q5+ | Solo si freemium core valida fuerte adopción |

NO HACEMOS en Q1: ads dentro del bot, vender datos, recomendar productos por comisión. Eso destruiría la confianza que estamos construyendo.

## CAC objetivo
**$0** durante Q1. Si necesitamos pagar para adquirir un usuario, no estamos respondiendo la pregunta correcta. El producto está construido sobre la hipótesis de que la combinación canal nativo + Reels + boca a boca = adquisición orgánica suficiente. Si no es cierto, el unit economics de un día puede ser bueno y aún así el negocio no escalar.

## LTV implícito (no monetario, pero crítico)
- Educación que reduce reclamos mal hechos a CMF (impacto público)
- Cada usuario es promotor (boca a boca a 3 personas) → coeficiente viral 3
- Cada usuario genera ~2 datos de pregunta que mejoran el corpus → producto se vuelve más útil con uso
