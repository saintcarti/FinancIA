# Runbook — Costo Claude se dispara

## Síntoma
Alerta `cost_today > $50 USD` o factura Anthropic crece sin explicación.

## Triage

### 1. ¿Quién consume?
```sql
-- Top 10 usuarios por costo últimas 24h
SELECT u.external_id, u.channel, COUNT(c.id) as conversations,
       SUM(cc.cost_usd) as cost
FROM claude_calls cc
JOIN conversations c ON c.id = cc.conversation_id
JOIN app_users u ON u.id = c.user_id
WHERE cc.created_at > NOW() - INTERVAL '24 hours'
GROUP BY u.external_id, u.channel
ORDER BY cost DESC
LIMIT 10;
```

Si 1 user > $5 USD/día → posible abuso. Bloquear vía admin endpoint.

### 2. ¿Routing OK?
```sql
-- Distribución modelo
SELECT model, COUNT(*) as calls, SUM(cost_usd) as cost
FROM claude_calls
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY model;
```
Si Sonnet > 30% del tráfico → clasificador roto, Haiku debería ser 90%.

### 3. ¿Cache funcionando?
```sql
-- % de cache hit
SELECT
  100.0 * SUM(cache_read_tokens) / NULLIF(SUM(input_tokens + cache_read_tokens), 0) as cache_pct
FROM claude_calls
WHERE created_at > NOW() - INTERVAL '24 hours';
```
Target ≥ 70%. Si < 50% → revisar prompt structure (¿se cambió el system prompt en algún deploy?).

### 4. ¿Tools loop infinito?
```sql
SELECT conversation_id, COUNT(*) as calls
FROM claude_calls
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY conversation_id
HAVING COUNT(*) > 8;
```
Si una conversación tiene > 8 llamadas en 1h → tool loop bug. Bloquear conv.

## Mitigación

- **Por usuario:** rate limit ya tope a 20/día. Si supera, mensaje empático.
- **Por conversación:** hard cap 4 iteraciones en `qa.ts` (`MAX_ITERATIONS`). Confirmar deploy actual.
- **Global:** flag `bot:cost_freeze=1` → bot devuelve "estamos en mantenimiento". Activar vía admin.

## Comunicación

Si el costo proyectado del mes excede 2× presupuesto: alertar al founder, decidir si pausar o aumentar presupuesto. Sin decisión en 4h → pausar por default.
