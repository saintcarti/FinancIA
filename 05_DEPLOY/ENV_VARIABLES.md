# ENV VARIABLES — Reference completo

Todas las variables de entorno usadas por el sistema, con su propósito, dónde obtenerlas y dónde se usan.

## Backend (Railway)

| Variable | Obtenerla en | Usada por |
|---|---|---|
| `NODE_ENV` | manual: `production` | global |
| `PORT` | Railway auto | server |
| `PUBLIC_BASE_URL` | tu dominio: `https://api.financia-chile.cl` | redirects, webhooks |
| `SUPABASE_URL` | Supabase → Settings → API | DB client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service role) | DB backend |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API (anon) | auth check |
| `REDIS_URL` | Upstash → Database → Endpoint (rediss://...) | cache, queue, rate limit |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/keys | LLM calls |
| `HAIKU_MODEL` | `claude-haiku-4-5-20251001` | routing |
| `SONNET_MODEL` | `claude-sonnet-4-6` | routing |
| `GOOGLE_AI_STUDIO_API_KEY` | https://aistudio.google.com/apikey | embeddings |
| `EMBEDDING_MODEL` | `text-embedding-004` | embeddings |
| `META_APP_SECRET` | Meta App Dashboard → Settings → Basic → App Secret | webhook HMAC verify |
| `META_VERIFY_TOKEN` | manual: cualquier string secreto | webhook GET handshake |
| `META_PAGE_ACCESS_TOKEN` | Meta Graph Explorer → Long-lived Page Token | enviar mensajes IG |
| `IG_USER_ID` | Graph API: `GET /me/accounts` → instagram_business_account.id | enviar mensajes IG |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App Dashboard → WhatsApp → API Setup | enviar mensajes WA |
| `WHATSAPP_ACCESS_TOKEN` | Meta App Dashboard → WhatsApp → permanent token | enviar mensajes WA |
| `CMF_API_KEY` | https://www.cmfchile.cl (registro free) — opcional | CMF cliente |
| `CMF_BASE_URL` | `https://api.cmfchile.cl/api-sbifv3/recursos_api` | CMF cliente |
| `INTERNAL_SECRET` | manual: 32 chars random | service-to-service auth |
| `SENTRY_DSN` | sentry.io → Project → Settings → Client Keys | error tracking |
| `RATE_LIMIT_PER_DAY` | `20` (default) | rate limit |
| `RATE_LIMIT_PER_HOUR` | `5` (default) | rate limit |

## n8n (Railway)

| Variable | Valor | Uso |
|---|---|---|
| `N8N_HOST` | `n8n.financia-chile.cl` | host config |
| `N8N_PORT` | `5678` | puerto interno |
| `N8N_PROTOCOL` | `https` | SSL |
| `N8N_BASIC_AUTH_ACTIVE` | `true` | proteger UI |
| `N8N_BASIC_AUTH_USER` | `admin` | UI auth |
| `N8N_BASIC_AUTH_PASSWORD` | 32 chars random | UI auth |
| `WEBHOOK_URL` | `https://n8n.financia-chile.cl/` | webhook endpoints |
| `PUBLIC_BASE_URL` | `https://api.financia-chile.cl` | usado por workflows para llamar backend |
| `INTERNAL_SECRET` | mismo que backend | autenticar al backend |
| `ANTHROPIC_API_KEY` | mismo | usado por workflow daily_reel |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io/app/settings/api-keys | TTS |
| `ELEVENLABS_VOICE_ID` | ElevenLabs → Voices → Default es-CL | TTS voice |

## Frontend (Vercel)

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_BASE` | `https://api.financia-chile.cl` |

## Generación segura de secrets

```bash
# INTERNAL_SECRET, n8n basic auth password, etc.
openssl rand -hex 32

# META_VERIFY_TOKEN (puede ser legible)
openssl rand -hex 16
```

## Rotación recomendada

| Tipo | Frecuencia | Procedimiento |
|---|---|---|
| `ANTHROPIC_API_KEY` | 90 días | Anthropic → Keys → revoke + create new |
| `GOOGLE_AI_STUDIO_API_KEY` | 90 días | Google AI Studio → regenerate |
| `META_PAGE_ACCESS_TOKEN` | 60 días | Meta Graph → debug → exchange long-lived |
| `INTERNAL_SECRET` | cada release | regenerar, rotar en backend + n8n simultáneo |
| `SUPABASE_SERVICE_ROLE_KEY` | en compromiso | Supabase Dashboard → reset |
| `META_APP_SECRET` | en compromiso | Meta Dashboard → reset |

## Verificación de configuración

```bash
# Local antes de deploy: validar que el .env carga sin errores
cd 03_BUILD/app/backend
npx tsx -e "import { config } from './src/config.js'; console.log(JSON.stringify(Object.keys(config()), null, 2))"
```

Si el output no es la lista completa de variables → error de config.

## Secrets que NUNCA deben aparecer

- En código fuente
- En logs (incluso debug)
- En issues de GitHub
- En PRs
- En Sentry breadcrumbs
- En messages a Slack o email

Si detectas leak: rotar inmediato + revisar logs + commit `BREAKING: rotate <key>` documentado.
