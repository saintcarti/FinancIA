# Runbook — Bot no responde

## Síntoma
Usuarios reportan que mandaron DM y no recibieron respuesta. Sentry muestra errores en webhook.

## Triage en orden

### 1. Verificar health
```bash
curl https://api.financia-chile.cl/api/health
```
Si `db: "down"` → ir a sección Database.
Si `redis: "down"` → ir a sección Redis.
Si `200 ok` pero bot no responde → seguir.

### 2. Verificar webhooks Meta
- Meta App Dashboard → Webhooks → Instagram → "Test"
- Si muestra error de verify token → token rotado en backend pero no en Meta
- Si `delivery_failures > 0` → backend está rechazando (HMAC fail)

### 3. Logs Railway
```bash
railway logs --tail 100 --service backend
```
Buscar: `invalid signature`, `worker job failed`, `Anthropic error`.

### 4. Cola BullMQ
- Conectarse a Redis: `redis-cli -u $REDIS_URL`
- `LLEN messages:wait` → si > 100 hay backlog
- `LRANGE messages:failed 0 5` → ver últimos fallidos

### 5. Anthropic status
- https://status.anthropic.com → ¿incidente vigente?
- Si rate limit: revisar `claude_calls` en últimos 5 min, ¿quién consume?

### 6. Bot pausado por flag
```bash
redis-cli -u $REDIS_URL GET bot:paused
```
Si `1` → alguien lo pausó manualmente. `DEL bot:paused` para reactivar.

## Mitigación rápida

- **Webhook spam de un usuario:** rate limit ya activo. Si abuso real: bloquear vía admin.
- **Anthropic down:** activar fallback "estamos en mantenimiento" via flag Redis.
- **Worker congelado:** redeploy Railway service `backend` (downtime ~30s).

## Comunicación

Si el incidente dura > 30 min:
- Story en Instagram: "Estamos en mantenimiento, volvemos en breve"
- Update en LinkedIn founder si > 2h

## Postmortem

Dentro de 72h en `docs/postmortems/YYYY-MM-DD-bot-down.md`. Sin culpables, foco en sistema.
