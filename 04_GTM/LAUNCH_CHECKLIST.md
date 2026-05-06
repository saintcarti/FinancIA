# LAUNCH CHECKLIST — FinancIA Chile

Checklist accionable T-7 → T+7 del lanzamiento público.

## T-7 (1 semana antes)

### Infra
- [ ] Producto deployado en URLs definitivas (api., admin., financia-chile.cl)
- [ ] Webhooks Meta configurados y verificados (Instagram + WhatsApp)
- [ ] WhatsApp Business templates aprobadas por Meta
- [ ] Sentry recibiendo errores de producción
- [ ] Backup automático Supabase activo
- [ ] DNS + SSL listos
- [ ] n8n workflows: daily_reel + cmf_normativa_watcher activos

### Contenido
- [ ] Cuenta IG @financia.chile con bio, avatar, primeros 3 posts del feed
- [ ] Highlights creados: Glosario, Cómo reclamar, Verificar entidad
- [ ] Primeros 7 Reels precargados como "drafts" para los primeros días
- [ ] Landing page financia-chile.cl publicada con copy final
- [ ] Política de privacidad + términos publicados

### Datos
- [ ] Corpus CMF inicial ingestado: 10 docs mínimo, 50+ chunks
- [ ] Eval set de 50 preguntas corrido — recall@5 ≥ 0.85
- [ ] Health check passing
- [ ] Smoke tests post-deploy passing

### PR
- [ ] Press release final aprobado
- [ ] Lista de 10 periodistas con email + teléfono
- [ ] 5 influencers contactados, al menos 2 confirmados para postear
- [ ] Maker comment de Product Hunt redactado
- [ ] Video demo 60s editado y subido

### Soft launch
- [ ] 50 amigos / red personal invitados a probar
- [ ] Grupo WhatsApp interno con feedback
- [ ] Documento de bugs reportados → 100% resueltos antes de T-1

---

## T-1 (día anterior)

- [ ] Press release enviado en embargo a 10 medios para 06:00 CLT del lanzamiento
- [ ] Posts LinkedIn + Instagram + Twitter del founder programados
- [ ] Email a red personal programado para 09:00 CLT del día siguiente
- [ ] Producto Hunt: post creado, programado para 12:01 AM PST
- [ ] Equipo (founder + 1 humano) en standby para responder DMs / hand-off
- [ ] Dashboard admin abierto en una pestaña permanente
- [ ] Cost monitor configurado con alerta @ $50 USD/día
- [ ] Discord/Slack del equipo conectado a webhook Sentry para alertas en vivo

---

## Launch Day (T+0)

### 06:00 CLT
- [ ] Verificar embargo de prensa cumplido
- [ ] Activar workflows n8n (si no estaban ya)
- [ ] Publicar Reel del día (manual override de horario para coincidir con peak)

### 09:00 CLT
- [ ] Post LinkedIn founder
- [ ] Post Instagram feed: "Lanzamos hoy"
- [ ] Email blast a red personal

### 12:00 CLT (peak almuerzo)
- [ ] Story Instagram con sticker de pregunta abierto
- [ ] Push manual de 1 historia más a periodistas que no respondieron embargo

### Continuamente
- [ ] Monitorear Sentry — cualquier error crítico se atiende en <30 min
- [ ] Revisar dashboard admin cada 30 min
- [ ] Responder cada DM dentro del SLA del bot — si bot falla, override humano
- [ ] Tracker de menciones en Twitter/IG/LinkedIn → screenshot todo

### Tracking horario
- 09:00 → 0 conversaciones / 0 DMs
- 12:00 → ¿llegamos a 50 conversaciones?
- 18:00 → ¿llegamos a 200?
- 23:00 → cierre del día con métricas

### Hot fixes prioritizados
- 🚨 Bot no responde → escalar a CTO immediately
- 🚨 Webhook 5xx → check Railway logs, restart si necesario
- ⚠️ Costo > $50 USD → revisar abuso de rate limit
- ⚠️ Tasa thumbs-down > 25% → revisar prompts y quizá pausar bot

---

## T+1 (día después)

- [ ] Update LinkedIn founder con métricas del día 1
- [ ] Email follow-up a periodistas que no cubrieron — caso real del día anterior
- [ ] Postmortem interno: ¿qué se rompió, qué funcionó, qué cambiar?
- [ ] Decidir cuándo activar Product Hunt (PH no necesariamente debe ser día 1; mejor con datos del día 1 mostrables)

---

## T+7 (semana 1)

- [ ] Update completo: 7 días, números reales, 1 caso de impacto documentado
- [ ] Si métricas son buenas (≥ 60% útiles, ≥ 200 DMs únicos): expandir agresivamente
- [ ] Si métricas son malas: postmortem + iteración antes de empujar más prensa
- [ ] Comenzar email a CMF / SERNAC con resultados de la semana 1

---

## Métricas de éxito del lanzamiento

| Métrica | Target Día 1 | Target Día 7 |
|---|---|---|
| DMs únicos iniciados | 100 | 500 |
| Conversaciones útiles % | ≥ 50% | ≥ 60% |
| Reels publicados | 1 | 7 |
| Menciones tier-1 (medios) | 1 | 3 |
| Errores Sentry | 0 critical | 0 critical |
| Costo total | < $5 USD | < $40 USD |
| Hand-off humano necesario | < 5% | < 5% |

---

## Plan de contingencia

| Escenario | Acción |
|---|---|
| Meta suspende app | Activar fallback: solo WhatsApp + comunicar transparente |
| Costo Claude se dispara | Pausar registros nuevos + audit de prompt routing |
| Hallucination crítica viralizada | Bot pausado 24h + comunicación pública 24h |
| Demanda > capacidad servidor | Auto-scale Railway + queue saturada → mensaje "tomemos un break" |
| Periodista escribe nota negativa | Respuesta pública dentro de 4h, sin defensividad, datos en mano |
