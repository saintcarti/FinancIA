# SUCCESS METRICS — FinancIA Chile

## North Star Metric
**Conversaciones útiles por semana**
Definida como: una conversación con ≥ 3 turnos donde el usuario marca thumbs-up o no abandona en el primer turno. Mide engagement real, no vanity.

## Métricas de adopción (Top of Funnel)
| Métrica | T+30 | T+90 | T+180 |
|---|---|---|---|
| Followers Instagram | 1.000 | 10.000 | 50.000 |
| DMs únicos iniciados | 300 | 3.000 | 20.000 |
| WhatsApp opt-ins | 100 | 1.500 | 10.000 |
| Reels publicados | 30 | 90 | 180 |
| Reach orgánico Reels | 50K | 500K | 3M |

## Métricas de producto (Activación + Retención)
| Métrica | Target |
|---|---|
| First-response time | < 8 segundos p95 |
| Conversaciones útiles / DMs únicos | ≥ 60% |
| Repeat rate (vuelve dentro de 7 días) | ≥ 35% |
| Thumbs-up rate | ≥ 75% |
| Hand-off a humano necesario | < 5% |
| Cobertura de preguntas (no "no sé") | ≥ 90% |

## Métricas de calidad (las que importan)
| Métrica | Target | Cómo se mide |
|---|---|---|
| Hallucination rate | < 1% | Auditoría manual semanal de 50 conversaciones random |
| Cita correcta CMF | 100% | Cada respuesta regulatoria debe linkear documento fuente |
| Disclaimer presente | 100% | Footer auto en cada mensaje, audit log |
| Datos actualizados (UF, IPC) | < 24h stale | Health check del cache CMF |

## Métricas de costo
| Métrica | Target |
|---|---|
| Costo por conversación | < $0.02 USD |
| Costo Haiku/Sonnet ratio | 90/10 (Haiku domina) |
| Cache hit rate prompts | ≥ 70% |
| Costo TTS por video | < $0.10 USD |

## Métricas de impacto (las que vendemos)
| Métrica | Target a 6 meses |
|---|---|
| Usuarios que reportan "ahora sé X" en encuesta | ≥ 70% |
| Reclamos a CMF generados con guía nuestra | ≥ 100/mes |
| Menciones en prensa | ≥ 5 medios tier-1 |
| Partnership oficial con regulador | 1 firmado |

## Tablero diario (mostrado en dashboard admin)
1. Conversaciones útiles hoy
2. Costo Claude hoy ($)
3. Top 5 temas preguntados hoy
4. Thumbs-up rate hoy
5. Reels publicados / engagement
6. Errores (Sentry)
7. Cache health CMF

## Anti-métricas (alertas si esto pasa)
- 🚨 Hallucination > 2% → freeze, audit, fix prompts
- 🚨 Costo/conversación > $0.05 → routing review
- 🚨 First-response > 15s p95 → infra review
- 🚨 Thumbs-down > 15% → prompt review
- 🚨 Disclaimer ausente → bloqueo immediate del bot
