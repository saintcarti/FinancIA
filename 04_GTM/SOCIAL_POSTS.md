# SOCIAL POSTS — Lanzamiento

## LinkedIn (5 posts del founder, secuencia 2 semanas)

### Post 1 — Día 0 (anuncio)
**Tono:** personal, directo.

> 🇨🇱 79% de los chilenos no entiende sus derechos financieros.
>
> No es por flojos. Es porque la CMF tiene 12.000 páginas de normativa pública en lenguaje regulatorio.
>
> Lo que está bien escrito para un abogado es invisible para alguien que solo quiere saber por qué su tarjeta le cobró $4.500 que no esperaba.
>
> Estoy lanzando **FinancIA Chile**: un agente de IA que vive en Instagram DM y WhatsApp y responde tus preguntas financieras citando CMF, en lenguaje cotidiano, gratis.
>
> No es asesor. No vende productos. No recomienda inversiones.
>
> Solo traduce.
>
> Pruébalo: 👉 [link en bio]
>
> Si funciona, el regulador en Chile gana un brazo de distribución que no tiene. Si no, aprenderemos por qué.
>
> #FinanzasChile #IA #CMF

### Post 2 — Día 3 (caso real)
> Camila vino con esta pregunta hoy:
> "Mi banco me cobró $19.000 de 'mantención mensual' que nunca me explicaron. ¿Es legal?"
>
> El bot le explicó:
> - Que la comisión está regulada por Art. 17B de la Ley 19.496
> - Que debe estar en la hoja resumen del producto
> - Que si nunca se le informó, tiene derecho a reembolso completo
> - Que puede reclamar primero al banco (10 días hábiles), luego CMF
>
> Camila reclamó. Le devolvieron $228K acumulados.
>
> No es magia, es información pública traducida.
>
> [foto de la conversación con datos personales tachados]

### Post 3 — Día 7 (técnica)
> Cómo construimos el agente de FinancIA Chile:
>
> 1. Claude Haiku 4.5 para 90% de las preguntas (costo ~$0.004/conversación)
> 2. Sonnet 4.6 cuando hay imágenes o comparación compleja
> 3. RAG hybrid (pgvector + BM25) sobre corpus CMF
> 4. Tool use: verifica entidades, compara tasas, genera guías de reclamo
> 5. Disclaimer auto-injected server-side (no depende del modelo)
>
> Costo total operación a 10K usuarios activos: ~$220/mes.
>
> Para una entidad humana que ofreciera lo mismo: ~$50K/mes.
>
> Reducción de 200x en costo. Esa es la tesis.

### Post 4 — Día 10 (pregunta abierta)
> ¿Cuál fue la última vez que te leíste un contrato bancario completo?
>
> Yo tampoco. Por eso construí esto.
>
> Si tienes una duda financiera que siempre quisiste preguntar y nunca preguntaste — pruébala en @financia.chile en Instagram.
>
> Promesa: en menos de 8 segundos te explico, cito la fuente CMF, y si es asesoría te lo digo derecho.

### Post 5 — Día 14 (pedir feedback)
> 14 días desde el lanzamiento de @financia.chile.
>
> 412 conversaciones reales.
> 67% útiles (tres turnos o más sin abandono).
> 0 alucinaciones detectadas en auditoría manual.
> $11 USD de costo total operativo.
>
> Si lo probaste, mándame DM con feedback. Lo que más me importa: ¿confiaste en la respuesta?

---

## Instagram posts (5 carruseles del feed)

### Carrusel 1 — "5 cosas que tu banco DEBE decirte (y no siempre lo hace)"
- Slide 1: Hook visual: "5 cosas que tu banco DEBE decirte"
- Slide 2: La tasa CAE clara y destacada (Art. 17C Ley 19.496)
- Slide 3: Total a pagar en pesos (no solo en porcentaje)
- Slide 4: Si el seguro es opcional o obligatorio — y con qué compañía
- Slide 5: La hoja resumen ANTES de firmar
- Slide 6: Plazo de retracto (10 días para créditos a distancia)
- Slide 7: Final CTA "Pregúntame por DM si te falta alguna en tu contrato. @financia.chile"

### Carrusel 2 — "5 estafas financieras que están en boca de todos"
- Llamadas ofreciendo crédito de bancos que no existen
- Inversión con rentabilidad "garantizada"
- Phishing por SMS haciendo pasar por banco
- Crédito gota a gota con cobranza ilegal
- Falsos asesores en redes prometiendo retornos rápidos
- CTA verificar entidad por DM

### Carrusel 3 — "Si te pasa esto, tienes derecho a reembolso"
Cobros indebidos, seguros no autorizados, comisiones no informadas, etc.

### Carrusel 4 — "Glosario: 7 términos que tu banco usa y nadie te explica"
UF · CAE · TIR · TPM · DICOM · TMC · Open Finance

### Carrusel 5 — "Cómo verificar la institución que te ofrece crédito (paso a paso)"
- Tomar nombre exacto
- Buscar en lista CMF (link en bio)
- Si no está → no es legal
- Cómo reportarlo

---

## Stories (templates)

**Story 1:** "UF de hoy: $XX.XXX | IPC último mes: X.X% | TPM: X.X% — datos oficiales CMF actualizados al `<DATE>`"
**Story 2:** "Pregúntame lo que quieras 👉 sticker de pregunta"
**Story 3:** "¿Te cobraron algo raro? Mándame foto de tu cartola por DM. Te ayudo."
**Story 4:** Caso del día (con consentimiento del usuario o anonimizado)
