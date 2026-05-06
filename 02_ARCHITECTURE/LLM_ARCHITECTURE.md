# LLM ARCHITECTURE — FinancIA Chile

## Modelos

| Tarea | Modelo | Razón |
|---|---|---|
| Q&A regulatorio simple (90%) | Haiku 4.5 | Costo bajo, suficiente para RAG + tool use |
| Q&A complejo (10%) | Sonnet 4.6 | Razonamiento sobre múltiples documentos |
| Clasificador de complejidad | Haiku 4.5 (200 tok output) | Decide routing antes de la llamada principal |
| Query expansion para RAG | Haiku 4.5 (100 tok output) | Reformula query del usuario para mejor retrieval |
| Generación de scripts de Reels | Sonnet 4.6 | Calidad creativa importa |
| Re-ranker de chunks RAG | MiniLM-L6-v2 ONNX local | No usa Claude — cero costo, baja latencia |
| Conversation summarization (cada 5 turns) | Haiku 4.5 | Comprime historial para mantener prompt corto |

## Prompt caching — segmentos

Cuando el SDK Anthropic recibe `cache_control: { type: "ephemeral" }`, esos bloques se cachean 5 min.

Segmentos cacheados (en orden, mayor a menor estabilidad):
1. **System prompt** (~800 tokens) — constante, cache 100%
2. **Reglas regulatorias del agente** (~600 tokens) — constante por release
3. **Tool definitions** (~400 tokens) — constante por release
4. **Conversation summary del usuario** (~300 tokens) — actualizada cada 5 turns

Resultado: ~2.100 tokens cacheados por request → solo ~300 tokens "frescos" pagan tarifa input completa.

## Routing logic

```typescript
async function classifyComplexity(userMessage: string): Promise<'simple' | 'complex'> {
  // Heurísticas baratas primero
  if (userMessage.length < 50) return 'simple';
  if (/imagen|foto|adjunt|este contrato/i.test(userMessage)) return 'complex';
  if (/(\bvs\b|\bversus\b|comparar|cuál.+(mejor|conviene))/i.test(userMessage)) return 'complex';

  // Si no decidió: preguntar a Haiku
  const r = await haiku({
    max_tokens: 10,
    system: 'Clasifica la pregunta como "simple" (FAQ regulatorio) o "complex" (requiere razonamiento, comparación, o análisis de documento adjunto). Responde solo una palabra.',
    messages: [{ role: 'user', content: userMessage }]
  });
  return r.content[0].text.trim().toLowerCase().includes('complex') ? 'complex' : 'simple';
}
```

## Tools (function calling)

### `verify_entity`
```json
{
  "name": "verify_entity",
  "description": "Verifica si una institución financiera está supervisada por la CMF y por lo tanto regulada en Chile. Úsala cuando el usuario menciona el nombre de un banco, cooperativa, financiera, AFP, compañía de seguros, fondo, o cualquier entidad que ofrezca productos financieros.",
  "input_schema": {
    "type": "object",
    "properties": {
      "name_or_rut": {
        "type": "string",
        "description": "Nombre comercial o RUT de la entidad. Ej: 'Banco de Chile', '97.004.000-5'"
      }
    },
    "required": ["name_or_rut"]
  }
}
```

### `compare_rates`
```json
{
  "name": "compare_rates",
  "description": "Compara la tasa de un producto que el usuario describe contra la Tasa Máxima Convencional vigente fijada por la CMF. Úsala cuando el usuario pregunta si una tasa es legal, si lo están cobrando de más, o si una oferta es razonable.",
  "input_schema": {
    "type": "object",
    "properties": {
      "product_type": {
        "type": "string",
        "enum": ["consumo", "linea_credito", "tarjeta_credito", "automotriz", "hipotecario"]
      },
      "amount_clp": { "type": "number" },
      "term_months": { "type": "integer" },
      "offered_rate_annual_pct": { "type": "number" }
    },
    "required": ["product_type", "amount_clp", "term_months", "offered_rate_annual_pct"]
  }
}
```

### `generate_complaint_guide`
```json
{
  "name": "generate_complaint_guide",
  "description": "Genera una guía paso a paso para que el usuario presente un reclamo formal ante la institución, CMF, o SERNAC, según el tipo de problema.",
  "input_schema": {
    "type": "object",
    "properties": {
      "institution": { "type": "string" },
      "issue_type": {
        "type": "string",
        "enum": ["cobro_indebido", "seguro_no_autorizado", "datos_dicom", "publicidad_enganosa", "negativa_atencion", "otro"]
      },
      "summary": { "type": "string", "description": "Resumen del problema en 1-2 frases" }
    },
    "required": ["institution", "issue_type", "summary"]
  }
}
```

### `get_indicator`
```json
{
  "name": "get_indicator",
  "description": "Devuelve el valor actual de un indicador económico chileno: UF, IPC, TPM, dólar observado, euro, UTM. Úsala cuando el usuario pregunta el valor de uno de estos indicadores hoy o en una fecha específica.",
  "input_schema": {
    "type": "object",
    "properties": {
      "indicator": { "type": "string", "enum": ["uf", "ipc", "tpm", "dolar", "euro", "utm"] },
      "date": { "type": "string", "format": "date", "description": "ISO 8601 YYYY-MM-DD; default hoy" }
    },
    "required": ["indicator"]
  }
}
```

## Tool execution loop

```
User message → Classifier → Routing
                              ↓
                  ┌───────────────────────┐
                  │ Loop (max 4 iters):   │
                  │  Claude responde      │
                  │  ¿tool call?          │
                  │   sí → ejecutar tool  │
                  │   no → final answer   │
                  └───────────────────────┘
                              ↓
                  Inject disclaimer footer
                              ↓
                  Send via Meta API
                              ↓
                  Persist + cost log
```

## Manejo de hallucination

1. **Cita obligatoria** — system prompt impone "incluye link al chunk fuente al final de cualquier afirmación regulatoria"
2. **Confidence threshold** — si retrieval top_score < 0.65 → respuesta debe explicitar "no tengo normativa específica, te oriento de manera general"
3. **Tool fallback** — si modelo intenta dar el valor de un indicador sin llamar `get_indicator` → bloquear via re-prompt
4. **Lista de palabras tóxicas** — si la respuesta contiene "te recomiendo invertir", "deberías comprar", "elige X" → bloquear y reformular

## System prompt base (versión 1.0, viene en `prompts/system_qa.md`)

Resumen:
- Rol: educador financiero que cita CMF
- Tono: cálido, claro, chileno
- Restricciones: no asesorar, no recomendar productos, citar fuente, mensajes < 200 palabras
- Tools disponibles: 4 listadas arriba
- Disclaimer: añadido server-side (no en el prompt — evita que el modelo lo "olvide")

## Versionado de prompts

Cada prompt está en `prompts/` con frontmatter:
```yaml
---
id: system_qa
version: 1.0.0
last_updated: 2026-05-06
owner: founder
eval_score_v1: 0.84
---
```

Cuando se cambia un prompt en producción → bump version + actualizar `prompts/CHANGELOG.md` + correr eval set.

## Costo logging

Cada llamada se loguea a `claude_calls`:
```sql
CREATE TABLE claude_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  message_id UUID,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cache_read_tokens INT DEFAULT 0,
  cache_write_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL,
  latency_ms INT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Dashboard admin agrega por día/modelo/tool y compara con factura mensual de Anthropic.
