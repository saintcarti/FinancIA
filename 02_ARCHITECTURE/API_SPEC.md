# API SPEC — FinancIA Chile

Base URL prod: `https://api.financia-chile.cl`
Auth: Supabase JWT en `Authorization: Bearer <token>` (admin API). Webhooks usan HMAC.

---

## Webhooks (públicos, HMAC verified)

### `GET /webhook/instagram`
Verificación Meta — responde `hub.challenge` si `hub.verify_token` matches `META_VERIFY_TOKEN`.

### `POST /webhook/instagram`
Recibe eventos de Instagram Messaging.
**Headers:**
- `X-Hub-Signature-256: sha256=<hmac>`
**Body (Meta payload):**
```json
{
  "object": "instagram",
  "entry": [{
    "id": "PAGE_ID",
    "messaging": [{
      "sender": { "id": "IG_USER_ID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1730000000000,
      "message": { "mid": "...", "text": "Hola, qué es la UF?" }
    }]
  }]
}
```
**Response:** `200 OK` siempre (Meta retry si no es 2xx).
**Procesamiento async:** encola job `process-message` en BullMQ. Webhook retorna inmediato.

### `GET /webhook/whatsapp`
Verificación equivalente.

### `POST /webhook/whatsapp`
Body Meta WhatsApp Cloud format. Misma encolación.

---

## Admin API (autenticada)

### `GET /api/health`
**Response 200:**
```json
{ "status": "ok", "uptime": 12345, "version": "0.1.0", "checks": { "db": "ok", "redis": "ok", "anthropic": "ok" } }
```

### `GET /api/conversations`
Query params: `limit` (default 50, max 200), `cursor`, `channel` (instagram|whatsapp), `flagged` (bool).
**Response 200:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "user_external_id": "ig_xxxx",
      "channel": "instagram",
      "started_at": "2026-05-06T10:00:00Z",
      "last_message_at": "2026-05-06T10:05:00Z",
      "message_count": 6,
      "satisfaction": "thumbs_up",
      "topics": ["UF", "CAE"],
      "flagged": false
    }
  ],
  "next_cursor": "..."
}
```

### `GET /api/conversations/:id`
**Response 200:**
```json
{
  "id": "uuid",
  "messages": [
    { "role": "user", "content": "...", "created_at": "..." },
    { "role": "assistant", "content": "...", "created_at": "...", "claude_call_id": "uuid", "cost_usd": 0.004 }
  ]
}
```

### `POST /api/conversations/:id/override`
Body: `{ "message": "Respuesta humana", "operator_id": "uuid" }`
Envía mensaje manual al usuario via Meta API; marca conversación con `human_in_loop=true` por 24h (bot pausado en esa conv).

### `GET /api/metrics/daily`
Query: `from`, `to` (ISO dates).
**Response 200:**
```json
{
  "data": [
    {
      "date": "2026-05-06",
      "conversations": 142,
      "useful_conversations": 89,
      "messages": 856,
      "thumbs_up": 65,
      "thumbs_down": 4,
      "cost_usd": 3.42,
      "tokens_input": 1240000,
      "tokens_output": 320000,
      "haiku_pct": 0.91,
      "reels_published": 1,
      "reels_engagement": { "views": 1200, "comments": 18, "dms_attributed": 7 }
    }
  ]
}
```

### `GET /api/metrics/topics`
Query: `from`, `to`, `top` (default 10).
**Response 200:**
```json
{
  "topics": [
    { "topic": "CAE", "count": 89, "satisfaction_rate": 0.84 },
    { "topic": "UF", "count": 67, "satisfaction_rate": 0.92 }
  ]
}
```

### `GET /api/reels`
Lista Reels publicados.

### `POST /api/reels/regenerate`
Body: `{ "prompt_override": "...", "publish": false }`
Regenera 1 Reel (manual override) — útil para QA.

### `GET /api/regulations`
Query: `q` (full text), `limit`.
Lista normativa indexada.

### `POST /api/regulations/reingest`
Trigger manual del re-ingest workflow.

### `GET /api/cmf/uf?date=2026-05-06`
Cache wrapper sobre CMF API.

### `GET /api/cmf/entity/:rut`
Verifica si entidad está supervisada.

---

## Internal endpoints (service-to-service, requieren `X-Internal-Secret`)

### `POST /internal/reel/publish`
Body: `{ "video_url": "...", "caption": "...", "hashtags": [...] }`
Publica a Instagram via Graph API. Llamado por workflow n8n.

### `POST /internal/embed/batch`
Body: `{ "texts": [...] }`
Devuelve embeddings de Google text-embedding-004.

---

## Errors estándar
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "User exceeded daily quota",
    "request_id": "uuid"
  }
}
```
Códigos:
- `400 INVALID_PAYLOAD` — body inválido
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 IDEMPOTENT_CONFLICT` — webhook ya procesado
- `429 RATE_LIMIT_EXCEEDED`
- `500 INTERNAL_ERROR`
- `503 UPSTREAM_DOWN` — Anthropic / Meta / Supabase down
