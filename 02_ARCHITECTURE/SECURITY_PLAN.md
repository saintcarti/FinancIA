# SECURITY PLAN — FinancIA Chile

## Threat model resumido

| Amenaza | Vector | Impacto | Mitigación |
|---|---|---|---|
| Webhook spoofing | Atacante POSTea a `/webhook/instagram` simulando Meta | Bot envía mensajes falsos | HMAC SHA-256 verify |
| Token leak | Token Meta o Anthropic en repo público / logs | Costos descontrolados, abuso | `.env` git-ignored, log redaction, rotación 90 días |
| Prompt injection | Usuario incrusta instrucciones maliciosas en DM | Bot ignora system prompt | System prompt como `system` channel + delimitadores; output guardrails |
| RCE en pdf-parse | PDF malicioso al ingestar | Compromiso del worker | Sandboxing del parser (worker thread + timeout) |
| SQL injection | Input usuario llega a SQL | Compromiso DB | Solo ORM/parametrized queries; no template strings con SQL |
| Abuso de bot por usuario | Spam de mensajes para inflar costo | Burning de presupuesto | Rate limit Redis 20/día/user, 5/hora |
| Scraping del corpus | Atacante extrae normativa indexada | Bajo (es público) | Rate limit en endpoints de búsqueda |
| Filtración PII | Logs incluyen contenido de mensajes | Violación Ley 19.628 | Log redaction; retention 90 días |
| Denial of Wallet (LLM) | Atacante envía requests caros | Bill shock Anthropic | Rate limit + budget alarms + max_tokens hard cap |

## Secrets management

### Categorías
- **Zernio (gestiona IG + WhatsApp):** `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`
- **Anthropic:** `ANTHROPIC_API_KEY`
- **Google:** `GOOGLE_AI_STUDIO_API_KEY` (embeddings)
- **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
- **Internal:** `INTERNAL_SECRET` (service-to-service)
- **External:** `CMF_API_KEY` (si aplica), `ELEVENLABS_API_KEY`

### Storage
- **Dev:** archivo `.env.local` git-ignored
- **Prod:** Railway secrets + Vercel encrypted env vars
- **NEVER:** en código, en logs, en commits, en imágenes Docker

### Rotación
- Anthropic + Google: cada 90 días
- Zernio API key: cada 90 días (rotable desde dashboard)
- Zernio webhook secret: cada 90 días (rotable; configurar nuevo, validar, deprecar viejo)
- Supabase service_role: en compromiso (Project Settings → API → Reset)
- Internal secret: cada release
- Si leak detectado → rotar inmediato + revisar logs últimos 30 días

## HMAC verification (webhook Zernio)

```typescript
function verifyZernioSignature(body: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expected = crypto
    .createHmac('sha256', process.env.ZERNIO_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}
```
- Header: `X-Zernio-Signature`
- Algoritmo: HMAC SHA-256 (lowercase hex)
- Aplicado **antes** de parsear JSON. Rechaza con 401.

## Rate limiting

```typescript
// Redis sliding window: 20 messages/día/user, 5/hora
async function checkRateLimit(userId: string): Promise<{ ok: boolean; resetAt?: number }> {
  const now = Date.now();
  const dayKey = `rl:d:${userId}`;
  const hourKey = `rl:h:${userId}`;

  const [dayCount, hourCount] = await redis.mget(dayKey, hourKey);

  if (Number(dayCount ?? 0) >= 20) return { ok: false, resetAt: now + 86400000 };
  if (Number(hourCount ?? 0) >= 5) return { ok: false, resetAt: now + 3600000 };

  const tx = redis.multi();
  tx.incr(dayKey).expire(dayKey, 86400);
  tx.incr(hourKey).expire(hourKey, 3600);
  await tx.exec();
  return { ok: true };
}
```

## Output guardrails (anti-hallucination)

Lista negra de patrones que activan re-prompt o bloqueo:
```typescript
const BLOCKED_PATTERNS = [
  /te recomiendo (invertir|comprar|vender)/i,
  /deberías (invertir|comprar|vender|elegir)/i,
  /esta es la mejor (opción|inversión)/i,
  /yo (compraría|invertiría|vendería)/i,
  /ganarás \$|garantizo (rentabilidad|ganancia)/i
];

function passesGuardrails(text: string): { ok: boolean; reason?: string } {
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(text)) return { ok: false, reason: `blocked pattern: ${p}` };
  }
  return { ok: true };
}
```
Si falla → re-prompt al modelo con "tu respuesta anterior dio una recomendación, reformula como educación neutral citando CMF".

## Privacidad / Ley 19.628

- **No solicitamos:** RUT, dirección, números de cuenta, contraseñas. Si el usuario los manda, redact server-side antes de log.
- **Hash de identificadores:** `user_external_id` se almacena en limpio (Meta lo da así); pero vinculaciones cross-channel se hacen vía hash interno.
- **Retention:** 90 días para `messages.content`. Después solo metadata.
- **Right to erasure:** endpoint admin `DELETE /api/users/:external_id` purga todo.
- **Disclaimer en bio Instagram + sitio:** "No solicitamos ni almacenamos datos sensibles. Lee nuestra política."

## Logs redaction

```typescript
const PII_PATTERNS = [
  { name: 'rut', regex: /\d{1,2}\.\d{3}\.\d{3}-[\dkK]/g, replace: '[RUT_REDACTED]' },
  { name: 'cuenta', regex: /\b\d{8,16}\b/g, replace: '[ACCOUNT_REDACTED]' },
  { name: 'email', regex: /[\w._%+-]+@[\w.-]+\.\w{2,}/g, replace: '[EMAIL_REDACTED]' },
  { name: 'phone', regex: /\+?56\s?9\s?\d{4}\s?\d{4}/g, replace: '[PHONE_REDACTED]' }
];

function redact(text: string): string {
  return PII_PATTERNS.reduce((t, { regex, replace }) => t.replace(regex, replace), text);
}
```
Aplicado a logger.info/warn/error antes de enviar a Sentry/Railway.

## Dependencies

- `npm audit` corriendo en CI
- Renovate bot semanal
- Dependencies con CVE high → patch en < 7 días
- Dependencies con CVE critical → patch en < 24h

## OWASP Top 10 — coverage

| OWASP 2021 | Cubierto en | Cómo |
|---|---|---|
| A01 Broken Access Control | Admin API | Supabase RLS + JWT verify middleware |
| A02 Cryptographic Failures | Webhooks, secrets | HMAC SHA-256, env-only secrets |
| A03 Injection | DB queries | ORM + parametrized; input zod-validated |
| A04 Insecure Design | Architecture | Threat model, principle of least privilege |
| A05 Security Misconfiguration | Headers | helmet middleware: HSTS, CSP, X-Frame-Options |
| A06 Vulnerable Components | Deps | npm audit + Renovate |
| A07 Identification Failures | Admin auth | Supabase magic link, no password |
| A08 Software/Data Integrity | Webhook idempotency | `processed_webhooks` table |
| A09 Logging Failures | Sentry + Supabase | Errors capturados, PII redactada |
| A10 SSRF | CMF/Meta clients | Allowlist de hostnames; no fetch a URL controlada por user |

## Incidente response

1. **Detectar:** Sentry alert / cost alert / user report
2. **Contener:** rotar tokens; deshabilitar webhook si activo (bot pausado vía flag Redis `bot:paused=1`)
3. **Investigar:** logs últimas 24h, dataflow afectado
4. **Comunicar:** si afecta usuarios, post de transparencia en redes en < 24h
5. **Postmortem:** público en <a href="https://github.com/..."`>repo</a> dentro de 72h
