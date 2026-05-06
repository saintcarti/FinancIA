# QUICKSTART — FinancIA Chile

5 comandos para tener todo funcionando local.

## Prerequisitos (1 vez)

```bash
# Tools
node --version   # >= 20
docker --version # >= 24
```

Cuentas (gratis):
- Supabase
- Anthropic
- Google AI Studio
- Zernio (gestiona IG + WhatsApp)
- (opcional) Upstash Redis si no quieres Docker local

## Setup (5 min)

```bash
# 1. Backend deps
cd 03_BUILD/app/backend && npm install

# 2. Frontend deps
cd ../frontend && npm install

# 3. Volver a root
cd ../../..
```

## Configuración (5 min)

1. **Supabase**: crea proyecto en supabase.com → SQL Editor → pega `03_BUILD/migrations/all.sql` → Run.
2. **Edita** `03_BUILD/app/backend/.env` con tus keys reales (ver placeholders pendientes con `PEGAR-AQUI`).
3. **Edita** `03_BUILD/app/frontend/.env` con tus keys de Supabase.

## Bootstrap del corpus + FAQ (3 min)

```bash
cd 03_BUILD/app/backend

# Indexa 10 docs base + 15 docs extra + 25 FAQ = 50+ chunks listos para responder
npm run ingest:all
```

## Validar que TODO funciona (1 min)

```bash
npm run validate
```

Output esperado:
```
✅ 1. Config loads
✅ 2. Supabase reachable
✅    regulations indexed (25 docs)
✅    embeddings indexed (140 chunks)
✅ 3. Redis reachable
✅ 4. Anthropic Haiku
✅ 5. Google embeddings (768d)
✅ 6. CMF UF live (UF=$38,502)
✅ 7. RAG retrieval (top score 0.84)
✅ 8a-c. Tools
✅ 9. Agent end-to-end ($0.004 USD, haiku)
✅ 10. Guardrails block recommendations
═══════════════════════════════════════
12 passed, 0 failed
✅ Sistema operativo. Listo para producción.
```

## Probar el agente (sin Zernio aún)

```bash
# Terminal 1: levanta backend
npm run dev

# Terminal 2: prueba con curl
curl -X POST http://localhost:3001/api/demo/chat \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: TU_INTERNAL_SECRET" \
  -d '{"message":"¿Qué es la UF?"}'
```

O usa `docs/api.http` con VS Code REST Client.

## Frontend admin

```bash
# Terminal 3
cd 03_BUILD/app/frontend
npm run dev
# Abre http://localhost:3000 → magic link a tu email
```

## Eval suite (calidad del agente)

```bash
cd 03_BUILD/app/backend

# Quick (10 preguntas, ~1 min)
npm run eval:quick

# Full (50 preguntas, ~5 min, $0.20 USD)
npm run eval:rag
```

Salida: `eval-report.json` + persistido en tabla `eval_runs`.

## Generar un Reel

```bash
cd 03_BUILD/app/backend

# Dry: solo genera el script + lo imprime (no persiste)
npm run generate-reel:dry

# Full: genera, persiste en DB (sin publicar todavía)
npm run generate-reel
```

## Conectar webhook real con Zernio (cuando tengas ZERNIO_API_KEY)

1. Local con ngrok:
```bash
ngrok http 3001
# Copia la URL https que te da
```

2. En zernio.com → Settings → Webhooks → Create:
   - URL: `https://tu-ngrok.ngrok.io/webhook/zernio`
   - Eventos: `message.received`
   - Copia el signing secret → `.env` ZERNIO_WEBHOOK_SECRET
3. zernio.com → Connect → conecta tu cuenta IG Business + WhatsApp Business
4. Manda un DM al perfil → debe responderte el bot

## Deploy a producción

```bash
./scripts/deploy.sh all
# Requiere vercel + railway CLIs logueados
```

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend con hot reload |
| `npm test` | Tests (vitest) |
| `npm run validate` | Comprueba que todo el sistema está operativo |
| `npm run ingest:all` | Indexa corpus completo (CMF + extra + FAQ) |
| `npm run eval:quick` | Eval con 10 preguntas |
| `npm run eval:rag` | Eval completo (50 preguntas) |
| `npm run generate-reel` | Genera 1 Reel (sin publicar) |
| `npm run generate-reel:dry` | Solo imprime el script |

## Troubleshooting rápido

| Error | Causa | Fix |
|---|---|---|
| `Config validation failed: ZERNIO_API_KEY` | falta env var | rellena `.env` |
| `Anthropic 401` | API key inválida o sin créditos | verifica console.anthropic.com |
| `RAG zero chunks` | corpus no indexado | corre `npm run ingest:all` |
| `Redis ECONNREFUSED` | redis no corriendo | `docker compose up redis` o usa Upstash |
| `relation "regulations" does not exist` | migración no aplicada | corre `migrations/all.sql` en Supabase |
| `pg_search 0` results pero embeddings sí | español tsvector ok pero sin matches | revisa que el chunk tenga el término |

## Estructura de comandos sugerida (orden)

```bash
# 1ra vez:
npm install                         # backend + frontend
# (aplica migraciones SQL en Supabase)
npm run ingest:all                  # popular corpus + FAQ
npm run validate                    # comprueba todo

# Día a día:
npm run dev                         # backend
# (otra terminal) cd frontend && npm run dev

# Antes de deploy:
npm test
npm run validate
npm run eval:quick

# Deploy:
./scripts/deploy.sh all
```
