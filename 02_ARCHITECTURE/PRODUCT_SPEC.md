# PRODUCT SPEC — FinancIA Chile

## Producto en una frase
Agente conversacional de IA, accesible por Instagram DM y WhatsApp, que responde preguntas financieras y regulatorias en lenguaje cotidiano usando datos de la CMF.

## Componentes del producto (lo que el usuario ve)

### 1. Cuenta de Instagram `@financia.chile`
- Bio: "Tu derecho financiero explicado simple. Pregúntame por DM 👉"
- Avatar: logo
- Reels diarios (1/día) educativos
- Posts feed: highlights de preguntas frecuentes (semanal)
- Stories: UF/IPC/TPM del día (auto-publicado)
- Highlights: "Glosario", "Cómo reclamar", "Verificar entidad"

### 2. Cuenta WhatsApp Business
- Display name: "FinancIA Chile"
- Welcome message:
  > Hola 👋 Soy FinancIA Chile, un asistente que te ayuda a entender finanzas, derechos y regulación en Chile en lenguaje simple. Pregúntame lo que sea sobre tu plata. *No doy asesoría financiera ni recomiendo productos*. ¿Qué quieres saber?
- 4 quick replies sugeridos:
  - "¿Qué es la UF?"
  - "Mi tasa CAE es alta?"
  - "Cómo reclamo a CMF"
  - "Quiero verificar un banco"

### 3. Landing page `financia-chile.cl`
- Hero: video corto del bot conversando + CTA "Pruébalo en Instagram"
- Cómo funciona (3 pasos)
- Ejemplos de preguntas (carrusel)
- FAQ (qué es, no es, privacidad, costos)
- About QUANT24
- Política de privacidad + términos

### 4. Admin dashboard (interno)
- Login: magic link Supabase
- Pantallas: Dashboard, Conversaciones, Reels, Costos, Settings
- Override manual de respuestas (hand-off humano)

## User stories

### Como Camila (deudora consciente)
- Quiero entender qué es el CAE de mi tarjeta sin googlear durante 20 minutos
- Quiero saber si me cobraron un seguro que no autoricé
- Quiero saber qué hacer si el banco no responde mi reclamo
- Quiero ver la UF de hoy sin abrir 3 apps

### Como Felipe (universitario)
- Quiero entender qué firmé al sacar mi primera tarjeta
- Quiero comparar 2 ofertas sin que me vendan una
- Quiero saber qué es DICOM y si me afecta

### Como Sandra (jubilada)
- Quiero saber si quien me llama es un banco real o estafa
- Quiero entender si me conviene el "crédito" que me ofrecen
- Quiero un humano si el bot no entiende mi pregunta

### Como Operador (founder + 1 humano)
- Quiero ver cuántas conversaciones hubo hoy y de qué temas
- Quiero leer una conversación específica si fue flagged
- Quiero responder manualmente si el bot dio respuesta mala
- Quiero saber cuánto gastamos hoy en Claude
- Quiero pausar el bot si hay incidente

## Flujos críticos del usuario

### Flujo: Usuario pregunta CAE
```
1. Camila ve Reel "Tu CAE puede estar mal calculado, te explico"
2. Tap en bio link → mini landing → "Pregúntame en Instagram"
3. Abre IG, manda DM "hola, qué es el CAE?"
4. Bot responde en 6s:
   "El CAE (Carga Anual Equivalente) es la tasa que muestra el costo TOTAL de tu crédito en %, incluyendo intereses y todos los cargos asociados — comisiones, seguros, gastos notariales. Es la forma más honesta de comparar entre ofertas: a CAE igual, dos créditos cuestan lo mismo aunque la "tasa" suene distinta.
   📌 Esto es información educativa basada en CMF. No constituye asesoría financiera. [link CMF Educa]"
5. Camila: "y si quiero compararlos?"
6. Bot: "Mándame los datos: monto, plazo, y los 2 CAE que te ofrecen, te ayudo a entender cuál es mejor."
7. Camila pega los datos
8. Bot llama tool `compare_rates`, responde con análisis y disclaimer
```

### Flujo: Sandra recibe llamada de "banco"
```
1. Sandra escribe a WhatsApp del bot:
   "Me llamó un señor del Banco Pacífico ofreciendo crédito"
2. Bot llama `verify_entity("Banco Pacífico")`
3. Si NO existe → respuesta: "🚨 No encuentro 'Banco Pacífico' en la lista de instituciones supervisadas por la CMF. Eso significa que no es un banco autorizado en Chile. Si te ofrecen crédito, podría ser una estafa. Aquí cómo denunciarlo: [guía paso a paso]"
4. Si SÍ existe → "Sí, está supervisado por CMF. Aquí su perfil oficial. Recuerda: bancos reales no piden datos sensibles por teléfono ni te apuran."
```

### Flujo: Bot no sabe responder
```
1. Usuario: "qué inversiones recomiendas en bolsa para 2026?"
2. Bot detecta patrón "recomiendas / inversión" → guardrail activa
3. Bot: "Eso es asesoría financiera personalizada y no puedo dártela — necesitas un asesor certificado por CMF. Lo que sí puedo: explicarte cómo funcionan los instrumentos disponibles, riesgos, y dónde verificar si el asesor es legítimo. ¿Por dónde quieres partir?"
```

### Flujo: Hand-off a humano
```
1. Bot detecta señal: usuario molesto + 3 thumbs-down + tema sensible
2. Bot: "Veo que esto necesita atención más cercana. Te conecto con un humano del equipo. Llegará a esta misma conversación en menos de 4 horas hábiles. Déjame saber si prefieres seguir conversando conmigo mientras tanto."
3. Backend: marca conversación con `human_in_loop=true`, suspende bot 24h
4. Slack alert al operador con link a conversación
5. Operador entra al admin dashboard, lee, responde via override
```

## Acceptance criteria por feature

### Feature: DM Instagram funcional end-to-end
- [ ] Usuario manda DM → recibe respuesta en < 8s
- [ ] Mensaje del bot incluye disclaimer footer
- [ ] Conversación se guarda en Supabase
- [ ] Idempotencia: Meta retry no genera mensaje duplicado
- [ ] Rate limit: 21° mensaje del día devuelve mensaje empático

### Feature: Generación de Reel diario
- [ ] Cron 09:00 CLT ejecuta sin intervención
- [ ] Reel publicado con audio + texto + caption + hashtags
- [ ] Caption incluye CTA "Pregunta por DM"
- [ ] Falla aislada (audio TTS down) no bloquea workflow al día siguiente

### Feature: Tools del agente
- [ ] `verify_entity` correcto para entidades supervisadas y no supervisadas
- [ ] `compare_rates` calcula contra TMC vigente
- [ ] `generate_complaint_guide` produce guía paso a paso lineable
- [ ] `get_indicator` devuelve UF/IPC/TPM hoy

### Feature: Admin dashboard
- [ ] Login con magic link funciona
- [ ] Lista conversaciones del día actualiza cada 30s
- [ ] Click conversación → ver mensajes
- [ ] Botón "Override manual" envía mensaje a IG/WhatsApp del usuario y pausa bot
- [ ] Métricas de costo cuadran con factura Anthropic ±5%

## Out of scope Q1
- ❌ Multi-idioma (solo español Chile)
- ❌ Voz (audio in/out)
- ❌ Imágenes generativas como respuesta
- ❌ Pago / suscripción
- ❌ App nativa
- ❌ Otros países
- ❌ Productos B2B (licencia para bancos)
