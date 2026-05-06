# Runbook — Hallucination crítica reportada

## Síntoma
Usuario o tercero reporta (especialmente en redes) que el bot dio una respuesta incorrecta sobre regulación que podría perjudicar al usuario.

## Severidad
**Crítica.** Afecta confianza pública. Tiempo de respuesta < 1h.

## Triage en orden

### 1. Reproducir
- Preguntar al usuario el screenshot exacto
- Buscar la conversación en admin dashboard
- Identificar la respuesta del bot, los chunks RAG usados (en `messages.tool_calls.rag_top_score`)

### 2. Verificar la afirmación contra fuente real
- Buscar la normativa correcta en CMF.cl
- Confirmar si el bot estaba equivocado o si la fuente del usuario está obsoleta

### 3. Si el bot estaba equivocado:

#### 3a. Pausar bot inmediato
```bash
redis-cli -u $REDIS_URL SET bot:paused 1
```
Bot devuelve mensaje "estamos auditando una respuesta, volvemos en breve".

#### 3b. Comunicación pública (< 4 horas)
- Reply al post original: "Tienes razón. Lo verificamos. La respuesta correcta es X. Pausamos el bot mientras revisamos."
- Story en IG con la corrección
- Si es viral: post LinkedIn del founder con la lección

#### 3c. Compensación al usuario
- DM personal al usuario afectado
- Si tomó acción equivocada por nuestra info → ayudar a corregir (con asesor humano si necesario)

### 4. Identificar causa raíz

**Hipótesis A — RAG irrelevant chunks:**
- ¿`combined_score` del top chunk era < 0.65? → debió decir "no tengo info específica"
- Fix: ajustar threshold + re-prompt al modelo en ese caso

**Hipótesis B — Modelo ignoró el contexto:**
- ¿El chunk correcto estaba en el contexto pero el modelo "alucinó"?
- Fix: reforzar prompt con "ÚNICA fuente válida es <context>", reducir temperatura a 0

**Hipótesis C — Normativa desactualizada:**
- ¿La normativa indexada está superseded?
- Fix: marcar `superseded=true` en SQL + re-ingest

**Hipótesis D — Tool no llamada:**
- ¿La pregunta requería verify_entity y el modelo respondió sin llamarla?
- Fix: reforzar prompt — "SIEMPRE llama el tool antes de afirmar X"

### 5. Fix + redeploy
- Patchear prompt o código
- Re-correr eval set 50 preguntas → debe pasar
- Re-deploy (Railway redeploy)

### 6. Reactivar
```bash
redis-cli -u $REDIS_URL DEL bot:paused
```
Smoke test: 5 preguntas reales antes de comunicar reactivación.

### 7. Postmortem público

Dentro de 72h: post en `financia-chile.cl/transparencia/<fecha>.md` con:
- Qué pasó
- Por qué pasó
- Qué arreglamos
- Cómo evitamos que vuelva a pasar

Sin defensividad. La transparencia gana confianza.

## Prevención

- Eval set se corre antes de cada cambio de prompt
- Auditoría manual semanal de 50 conversaciones random
- Disclaimer ya está auto-injected (mitigador parcial)
- Cita CMF en cada respuesta facilita verificación

## NO hacer

- ❌ Borrar la conversación del usuario
- ❌ Bloquear al usuario que reportó
- ❌ "Es solo un bot, no es asesoría" como defensa pública (es cierto pero no es excusa)
- ❌ Pausar más de 24h sin comunicar — pierdes momentum + confianza
