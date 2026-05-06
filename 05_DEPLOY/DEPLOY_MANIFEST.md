# DEPLOY MANIFEST — FinancIA Chile

## URLs de producción

| Servicio | URL | Plataforma |
|---|---|---|
| Admin Dashboard | https://admin.financia-chile.cl | Vercel |
| Backend API | https://api.financia-chile.cl | Railway |
| n8n Workflows | https://n8n.financia-chile.cl (basic auth) | Railway |
| Landing público | https://financia-chile.cl | Vercel |
| Database | [Supabase project] | Supabase |
| Redis | Upstash Redis Cloud | Upstash |
| Storage assets | Supabase Storage bucket `reels-public` | Supabase |

## Despliegue paso a paso

### Pre-requisitos
- Dominio `financia-chile.cl` comprado en NIC Chile
- Cuentas: Vercel, Railway, Supabase, Upstash, Anthropic, Google AI Studio, Meta Developers, ElevenLabs, Sentry
- GitHub repo con el código
- API keys cargadas en gestor seguro (1Password recomendado)

### Paso 1 — Supabase
1. Crear proyecto nuevo (región `sa-east-1` São Paulo)
2. Database → Extensions: habilitar `vector` y `pg_trgm`
3. SQL editor → pegar y ejecutar `03_BUILD/migrations/001_initial_schema.sql`
4. Auth → Email Provider → habilitar magic links
5. Storage → crear bucket público `reels-public` con políticas:
   - SELECT: público
   - INSERT/UPDATE: solo service_role
6. Settings → API: copiar `URL`, `anon key`, `service_role key`
7. Settings → Auth → Email Templates: customizar magic link en español
8. Database → Backups: habilitar daily

### Paso 2 — Upstash Redis
1. Crear database (región `sa-east-1`)
2. Copiar `REDIS_URL`
3. Habilitar TLS

### Paso 3 — Meta Developer App
1. Crear App en developers.facebook.com → tipo "Business"
2. Agregar productos:
   - Instagram Graph API
   - Webhooks
   - WhatsApp Business
3. Conectar página Facebook → Instagram Business Account
4. Generar:
   - Page Access Token (long-lived) → `META_PAGE_ACCESS_TOKEN`
   - App Secret → `META_APP_SECRET`
5. Webhooks:
   - Subscribe `instagram` events
   - Suscriptarse a: `messages`, `messaging_postbacks`, `comments`
   - Callback URL: `https://api.financia-chile.cl/webhook/instagram`
   - Verify Token: lo que defines en `.env`
   - Click "Verify and Save" → backend debe estar live
6. Repetir para WhatsApp:
   - Agregar número de prueba
   - Verificar (Meta envía SMS)
   - Solicitar templates de bienvenida (24h aprobación)

### Paso 4 — Railway (backend + n8n)
1. Crear proyecto nuevo
2. Add service "GitHub repo" → seleccionar `03_BUILD/app/backend`
3. Build command: `npm install && npm run build`
4. Start command: `node dist/index.js`
5. Variables: pegar todas las del `.env.example` (ver `ENV_VARIABLES.md`)
6. Custom domain: `api.financia-chile.cl`
7. Railway internal: agregar Redis (o conectar a Upstash externo)
8. Logs: integrar con Sentry via DSN

9. Add service "Docker Image" → `n8nio/n8n:latest`
10. Persistent volume: 1GB
11. Variables n8n:
    ```
    N8N_HOST=n8n.financia-chile.cl
    N8N_PROTOCOL=https
    N8N_BASIC_AUTH_ACTIVE=true
    N8N_BASIC_AUTH_USER=admin
    N8N_BASIC_AUTH_PASSWORD=<generar-32-chars>
    PUBLIC_BASE_URL=https://api.financia-chile.cl
    INTERNAL_SECRET=<mismo del backend>
    ANTHROPIC_API_KEY=<mismo>
    ELEVENLABS_API_KEY=<...>
    ELEVENLABS_VOICE_ID=<...>
    ```
12. Custom domain: `n8n.financia-chile.cl`
13. Importar los 4 workflows desde `03_BUILD/n8n-workflows/`
14. Activar workflows (toggle on)

### Paso 5 — Vercel (frontend admin + landing)
1. Import GitHub repo → seleccionar `03_BUILD/app/frontend` como root
2. Framework: Next.js (auto-detected)
3. Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_API_BASE=https://api.financia-chile.cl
   ```
4. Custom domain: `admin.financia-chile.cl`
5. Deploy
6. Para el landing público (separado): crear segundo proyecto Vercel con folder específico (futuro Q1 sprint 2)

### Paso 6 — DNS (NIC Chile o Cloudflare)
- `financia-chile.cl` → A record Vercel landing
- `admin.financia-chile.cl` → CNAME admin Vercel
- `api.financia-chile.cl` → CNAME api Railway
- `n8n.financia-chile.cl` → CNAME n8n Railway
- TXT records: SPF, DKIM (si usamos email transaccional)

### Paso 7 — Smoke tests post-deploy
```bash
# Health check backend
curl https://api.financia-chile.cl/api/health
# → { "status": "ok", "checks": { "db": "ok", "redis": "ok" } }

# CMF live data
curl https://api.financia-chile.cl/api/cmf/uf
# → { "value": 38XXX.XX, "date": "2026-XX-XX" }

# Webhook verify (Instagram)
curl 'https://api.financia-chile.cl/webhook/instagram?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123'
# → 200 + body "test123"

# Frontend admin loads
curl -I https://admin.financia-chile.cl
# → 200

# Login flow:
# 1. Visitar admin → ingresar email autorizado
# 2. Recibir magic link
# 3. Click → redirige a /dashboard
# 4. Dashboard muestra "Aún no hay métricas" si no hay datos
```

### Paso 8 — Ingesta inicial corpus CMF
```bash
# En local (o como Railway one-shot job)
cd 03_BUILD/app/backend
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_AI_STUDIO_API_KEY=... \
  npm run ingest:cmf
```
Verifica en Supabase Studio: tabla `regulations` debe tener 10 filas, `embeddings` debe tener ~50+ filas con dim=768.

### Paso 9 — Test end-to-end
1. Manda DM al perfil IG `@financia.chile` desde una cuenta personal
2. Backend recibe webhook → procesa → responde via Meta API
3. Verifica en admin dashboard → conversación aparece
4. Marca thumbs-down → se persiste

### Paso 10 — Activar workflow Reel diario
1. n8n UI → "Daily Reel" → ejecutar manual primero (verifica end-to-end)
2. Una vez verificado: toggle ON → cron 09:00 CLT activo

---

## Rollback plan

Si algo se rompe en producción:

```bash
# Railway: revertir al deploy anterior
railway service rollback <previous-deploy-id>

# Vercel: revertir
vercel rollback <previous-deployment-url>

# Supabase: restore snapshot (último backup diario)
# Via Supabase dashboard → Database → Backups → Restore
```

Estado degradado aceptable durante incidente: bot pausado vía flag Redis `bot:paused=1`. Endpoint admin: `POST /api/admin/system/pause`.
