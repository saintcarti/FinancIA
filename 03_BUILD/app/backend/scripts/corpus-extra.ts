/**
 * Corpus extra — 15 documentos adicionales sobre temas que la gente pregunta
 * frecuentemente. Se ingestan SOBRE el seed inicial via:
 *   npm run ingest:cmf   (corre seed)
 *   npm run ingest:extra (corre este)
 *
 * Mantienen la misma estructura SeedDoc.
 */
import { supabase } from '../src/lib/supabase.js';
import { embedBatch } from '../src/lib/google-embeddings.js';
import { logger } from '../src/lib/logger.js';

interface Doc {
  source_url: string;
  title: string;
  document_type: 'circular' | 'norma' | 'guide' | 'law' | 'glossary';
  inline_text: string;
}

const DOCS: Doc[] = [
  {
    source_url: 'https://www.cmfchile.cl/educa/621/articles-1131_recurso_2.pdf',
    title: 'CAE — Cómo verificarlo y comparar créditos',
    document_type: 'guide',
    inline_text: `
CÓMO COMPARAR CRÉDITOS USANDO LA CAE

La Carga Anual Equivalente (CAE) es el indicador OFICIAL para comparar créditos en Chile. Lo regula la Ley 19.496 (Art. 17B).

Por qué importa:
- Dos créditos con la misma "tasa de interés" pueden tener CAE muy diferentes
- La diferencia viene de comisiones, seguros, gastos asociados
- A CAE igual, dos créditos cuestan exactamente lo mismo en términos anuales

Ejemplo concreto:
Crédito A: tasa 1.5% mensual, sin seguro adicional → CAE 19.5%
Crédito B: tasa 1.4% mensual + seguro obligatorio + comisión administración → CAE 24.8%

A pesar de que B tiene "tasa menor", es más caro.

Cómo verificar tu CAE:
1. Pide la "hoja resumen" del producto (es obligatorio entregártela antes de firmar, Ley 19.496 Art. 17B)
2. La hoja debe mostrar: monto, plazo, tasa, CAE, total a pagar, todos los gastos
3. Si la diferencia entre tasa y CAE es > 5 puntos porcentuales, hay costos asociados que vale la pena revisar
4. Simulador oficial gratuito: https://www.cmfchile.cl/educa/621/w3-propertyvalue-12434.html

Qué hacer si tu CAE está mal calculada:
- Reclamo a la institución (10 días hábiles)
- Si no responden o respuesta insatisfactoria → CMF reclamo
- En paralelo, SERNAC también recibe estos casos
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-9018_doc_pdf.pdf',
    title: 'Tarjetas de crédito — derechos y obligaciones',
    document_type: 'guide',
    inline_text: `
TARJETAS DE CRÉDITO EN CHILE — TUS DERECHOS

Información obligatoria que la institución debe darte (Ley 19.496):
- Tasa de interés (mensual y anual)
- CAE de la tarjeta
- Comisión por mantención (mensual o anual)
- Cuota de incorporación (si aplica)
- Costos por avances en efectivo
- Costos por compras en el extranjero
- Cobertura de seguros incluidos (y si son opcionales o no)
- Procedimiento para uso fraudulento

Derechos clave:
1. PRE-PAGO: puedes pagar tu deuda total o parcial sin penalidad. La institución no puede cobrarte más allá del 1% del monto prepagado (créditos ≤ 5.000 UF) o 1.5% (mayores). Para tarjetas de crédito en general: prepagas sin costo extra.

2. RETRACTO: si contrataste a distancia (online, teléfono), puedes anular en 10 días contados desde la activación, sin expresión de causa, sin penalidad. EXCEPCIÓN: créditos > 100 UF.

3. INFORMACIÓN: cada cartola debe mostrar claramente: tasa aplicada al período, total deuda, fecha de pago, monto mínimo, monto rotativo, intereses generados.

4. SEGUROS: el banco NO puede obligarte a contratar el seguro con su compañía. Tienes derecho a comparar y elegir aseguradora.

5. NEGATIVA AL USO INDEBIDO: si te roban la tarjeta y avisas inmediatamente, NO eres responsable de los cargos posteriores al aviso.

Lo que el banco NO puede hacer:
- Subir la tasa unilateralmente sin aviso de 30 días
- Cobrar comisiones no estipuladas en el contrato
- Cobrar por consultas de saldo en cajero del propio banco
- Cobrar seguros contratados sin tu autorización expresa
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25111_doc_pdf.pdf',
    title: 'Crédito hipotecario — guía del consumidor',
    document_type: 'guide',
    inline_text: `
CRÉDITO HIPOTECARIO — LO QUE DEBES SABER

Tipos de crédito hipotecario en Chile:
1. Mutuo hipotecario endosable: tradicional, plazo hasta 30 años, tasa fija o variable
2. Mutuo hipotecario no endosable: plazo y tasa similares, no se puede ceder
3. Letra hipotecaria: histórico, casi extinto

Variables clave:
- Tasa: en UF + interés (ej: UF + 4.2%)
- Plazo: hasta 30 años
- Pie mínimo: 10-20% del valor (depende del banco y tipo)
- Tasación: la pagas tú (~$300K), valida el valor real
- Estudio de título: ~$200-400K, verifica que la propiedad esté libre de gravámenes
- Notaría + Conservador: 0.5-1% del monto
- Seguros: incendio + desgravamen (obligatorios). Cesantía e invalidez son opcionales.

CAE en hipotecario es CRÍTICO porque:
- Hay muchos costos asociados (notaría, conservador, tasación, seguros)
- Diferencia entre tasa pública y CAE puede ser 1-2 puntos completos

Tu derecho de elección:
- Compañía de seguros: TÚ ELIGES, no el banco (Art. 17D Ley 19.496)
- Notaría: TÚ ELIGES, salvo que escrituras múltiples partes
- Tasador: el banco lo elige pero TÚ pagas

Pre-pago hipotecario:
- Total: comisión máxima 1.5% del capital prepagado (créditos > 5.000 UF) o 1% (menores)
- Parcial: misma regla

Refinanciamiento (cambiar de banco):
- Es legal y libre
- El banco original NO puede penalizarte más allá del prepago legal
- El nuevo banco gestiona traspaso

Reclamos hipotecarios:
- 1ro: institución
- 2do: CMF
- 3ro: Tribunales (si hay perjuicio mayor)
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_3.pdf',
    title: 'Pre-pago de créditos — Ley 19.496 Art. 17L',
    document_type: 'law',
    inline_text: `
DERECHO DE PRE-PAGO DE CRÉDITOS

Ley 19.496, Artículo 17 L: el consumidor tiene derecho a pagar anticipadamente, total o parcialmente, cualquier crédito de consumo o hipotecario.

LÍMITES DE COMISIÓN POR PRE-PAGO:

Para créditos de consumo:
- Hasta 5.000 UF: comisión máxima = 1% del capital prepagado
- Más de 5.000 UF: comisión máxima = 1.5% del capital prepagado

Para créditos hipotecarios:
- Misma regla
- Si el contrato pacta una comisión MENOR, prevalece el contrato

Lo que la institución NO puede hacer:
- Cobrar más allá de estos límites
- Negar el pre-pago bajo cualquier excusa
- Aplicar penalizaciones distintas a la comisión legal
- Demorar el cierre del crédito (debe ser inmediato post-pago)

Pre-pago parcial:
- Reduce el capital
- Tienes derecho a elegir entre: (a) misma cuota con menor plazo, o (b) menor cuota con mismo plazo
- La institución debe entregarte cálculo nuevo de tabla de pagos

Pre-pago total:
- Cierre del crédito en 5 días hábiles
- Devolución de seguros pre-pagados (proporcional al tiempo no usado)
- Carta de cierre para tu archivo personal

Si la institución viola este derecho:
- Reclamo formal (10 días)
- CMF + SERNAC
- Acción judicial individual o colectiva
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-9018_doc_pdf2.pdf',
    title: 'Cuenta corriente y cuenta vista — diferencias y costos',
    document_type: 'guide',
    inline_text: `
CUENTA CORRIENTE vs CUENTA VISTA

Cuenta Corriente (CC):
- Permite emisión de cheques
- Generalmente tiene línea de crédito asociada
- Cobra comisión mensual de mantención (varía $3.000-$15.000)
- Requiere ingreso mínimo o saldo promedio (depende del banco)
- Sujeta a evaluación crediticia previa
- Apta para personas con sueldo formal y estable

Cuenta Vista:
- No permite cheques (CuentaRUT, RUT Chile, similar)
- No tiene línea de crédito
- Sin requisito de ingreso mínimo (en muchas)
- Comisiones: en general, $0 mantención. Algunas cobran por giros en cajeros externos.
- No requiere evaluación crediticia
- Apta para casi todos (incluso menores con autorización)

Costos típicos a revisar:
1. Mantención mensual
2. Comisión por giros en cajeros de OTROS bancos
3. Comisión por transferencias a otros bancos (TEF) — cada vez menos común
4. Cobros por cartola física (si la pides)
5. Comisión por uso internacional

LO QUE DEBES REVISAR ANTES DE CONTRATAR:

- Tarifario completo: pídelo en sucursal o sitio web
- Si la mantención está condicionada a algún uso (ej: 5 transacciones al mes)
- Política de exención (algunos bancos eximen mantención si tu sueldo se abona ahí)
- Costos por servicios opcionales que vienen "incluidos por default" (alertas SMS, paquetes de cheques, seguros)

Tus derechos:
- Conocer todos los costos antes de firmar (Ley 19.496 Art. 17B)
- Cancelar la cuenta sin penalidad (excepto pago de saldo si hay deudas)
- Cambiar tu sueldo a otro banco sin que el banco original te cobre extra
- Pedir devolución de comisiones cobradas sin justificación
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_4.pdf',
    title: 'Línea de crédito — cómo funciona y cuándo conviene',
    document_type: 'guide',
    inline_text: `
LÍNEA DE CRÉDITO ASOCIADA A CUENTA CORRIENTE

¿Qué es?
Un cupo de crédito pre-aprobado, asociado a tu cuenta corriente, que puedes usar cuando tu saldo se vuelve negativo. Funciona como una "extensión" de la cuenta.

Cómo se cobra:
- Solo pagas intereses por el monto efectivamente usado
- La tasa es típicamente alta (mayor que crédito de consumo)
- Se cobra día a día sobre el saldo deudor
- El interés se carga junto con la mantención mensual

CAE de líneas de crédito:
- Suele ser entre 25%-30% anual
- En algunos casos puede llegar al límite legal de la TMC (Tasa Máxima Convencional)
- Verifica siempre el CAE en la hoja resumen

Ventajas:
- Liquidez inmediata sin trámite
- Solo pagas si la usas
- Útil para emergencias

Desventajas:
- Una de las formas más caras de financiamiento
- Fácil de "olvidar" pagar (se carga automático)
- Puede generar dependencia y endeudamiento crónico

Cuándo conviene usar:
- Emergencias verdaderas (sin tiempo para tramitar otro crédito)
- Por períodos cortos (días o pocas semanas)
- Cuando tienes claridad de cuándo y cómo la pagarás

Cuándo NO conviene:
- Para gastos planificados (mejor un crédito de consumo, más barato)
- Como "reserva permanente" (los intereses se acumulan)
- Para inversiones (la tasa es prohibitiva)

Lo que la ley exige:
- Información clara antes de la contratación
- CAE visible en estado de cuenta
- Posibilidad de reducir o cancelar la línea sin costo
- No puede ser activada sin autorización expresa
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_5.pdf',
    title: 'Open Finance Chile — qué es y qué cambia',
    document_type: 'law',
    inline_text: `
OPEN FINANCE EN CHILE — LEY 21.521

¿Qué es?
Sistema obligatorio de intercambio estandarizado de datos financieros entre instituciones, con autorización expresa del cliente, mediante APIs.

Vigencia:
- Ley 21.521 (Ley Fintech) promulgada en 2023
- Reglamentación en implementación 2025-2026
- Supervisada por la CMF

Qué te permite (como cliente):
1. PORTABILIDAD DE DATOS: pedir a tu banco que comparta tu historial financiero con otra institución, en formato estándar.
2. COMPARACIÓN INFORMADA: que terceros (apps, fintechs) accedan a tus datos para ofrecerte mejores ofertas.
3. AGREGACIÓN: ver todas tus cuentas, créditos, inversiones de distintos proveedores en una sola app.
4. PAGO INICIADO: pagar directamente desde una cuenta sin pasar por la app del banco (similar a Apple Pay vía cuenta).
5. SCORING ALTERNATIVO: que un fintech use tus datos del banco original para evaluarte mejor que solo DICOM.

Qué NO ocurre automáticamente:
- Tus datos NO se comparten sin tu consentimiento expreso
- Cada autorización es revocable en cualquier momento
- Las instituciones no pueden monetizar tus datos sin tu permiso
- Hay obligación de seguridad estándar (encriptación, autenticación fuerte)

Implicancias para el consumidor común:
- En 1-2 años habrá apps que te muestren todo tu portafolio
- Los créditos pre-aprobados serán más certeros (con datos reales)
- La movilidad bancaria se simplifica (cambiar de banco con tu historial)
- Las fintech podrán competir en igualdad técnica con bancos tradicionales

Riesgos a vigilar:
- Phishing pidiendo "autorizar tu Open Finance" (verifica fuentes)
- Apps que no estén en el registro de la CMF (no compartas datos)
- Sobreendeudamiento facilitado por créditos pre-aprobados
- Pérdida de privacidad si autorizas en bloque sin leer
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_6.pdf',
    title: 'Seguros asociados a productos financieros — derechos del consumidor',
    document_type: 'guide',
    inline_text: `
SEGUROS Y PRODUCTOS FINANCIEROS — TUS DERECHOS

Por ley (Art. 17D Ley 19.496), cuando un crédito requiere seguro, TÚ ELIGES la compañía aseguradora. La institución financiera NO PUEDE imponerte la suya.

Tipos de seguros típicos:
1. Desgravamen: cubre saldo del crédito si fallece o queda inválido el deudor. Obligatorio en hipotecarios y muchos consumos.
2. Incendio: cubre la propiedad. Obligatorio en hipotecarios.
3. Cesantía: cubre cuotas si quedas desempleado. OPCIONAL.
4. Invalidez/Hospitalización: cubre cuotas en caso de salud. OPCIONAL.
5. Vida: cobertura adicional. OPCIONAL.

Lo obligatorio vs opcional:
- Obligatorios: ligados al riesgo del crédito (desgravamen para créditos personales, incendio para hipotecarios)
- TODO lo demás es opcional, aunque te lo "agreguen al paquete"

Tus derechos:
1. Comparar antes de contratar — la institución debe darte tiempo
2. Elegir compañía: TÚ decides, no el banco
3. Cancelación: puedes cancelar el seguro opcional en cualquier momento, con devolución prorrateada
4. Cambio de seguro: puedes cambiar de compañía año tras año, sin que el banco te suba la tasa por eso
5. Información: la prima debe estar incluida en el CAE del crédito

Casos típicos de abuso:
1. Seguros agregados al crédito sin tu autorización expresa
2. Seguros con cobertura limitada o exclusiones excesivas
3. Imposición de la aseguradora del banco (ilegal)
4. Cobros en la cartola con código indescifrable

Cómo verificar tus seguros activos:
- Cartola mensual debe listar todos los seguros pagados
- Pide al banco la "póliza" (es tu copia del seguro)
- Si un seguro aparece y no recuerdas haberlo contratado: pide comprobante de aceptación expresa. Si no existe → tienes derecho a devolución total.

Reclamación:
- 1ro: aseguradora (10 días hábiles)
- 2do: CMF (no Comisión de Seguros, ya unificada en CMF desde 2017)
- En paralelo: SERNAC
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_7.pdf',
    title: 'Cómo salir de DICOM — derechos del deudor',
    document_type: 'guide',
    inline_text: `
DICOM Y CÓMO MEJORAR TU SITUACIÓN COMERCIAL

¿Qué es DICOM realmente?
Es un registro privado de información comercial (gestionado por Equifax). Las instituciones reportan deudas vencidas para que otras evalúen el riesgo crediticio.

Qué se reporta:
- Deudas vencidas > 30 días corridos
- Cheques protestados
- Deudas tributarias (informa el SII)
- Cuentas judicializadas
- Tarjetas, créditos, casas comerciales, telefonía

Qué NO se reporta:
- Deudas inferiores al monto mínimo (varía por reglamento)
- Cuentas bancarias normales
- Tarjetas pagadas al día
- Información sobre tu trabajo, sueldo, dirección

Tus derechos (Ley 19.628 sobre datos personales):
1. INFORMACIÓN GRATUITA: tienes derecho a una hoja de información comercial (HIC) gratis al año. Pídela en equifax.cl.
2. CORRECCIÓN: si una deuda aparece y NO es tuya o ya pagada, tienes derecho a que se elimine. Pide a la institución que reporte el pago.
3. PLAZO DE ELIMINACIÓN: deuda pagada debe salir en máximo 30 días corridos.
4. PROTECCIÓN POR LEY DE QUIEBRA PERSONAL (Ley 20.720): si te declaras en quiebra personal, las deudas se renegocian o cancelan, y DICOM debe limpiarse en 90 días post-resolución.

Cómo "salir de DICOM":
1. PAGAR: la mejor forma. Una vez pagado, exige a la institución que reporte el pago a Equifax. Verifica en 30 días que ya no aparezcas.
2. RENEGOCIAR: si no puedes pagar todo, negocia con la institución una repactación. Esta se reporta también, pero con código distinto.
3. JUDICIALIZACIÓN: si te demandan, defenderte en juicio (con abogado o defensor público).
4. QUIEBRA PERSONAL: si tienes múltiples deudas y no puedes pagarlas todas, evalúa la Ley de Reorganización y Liquidación (Ley 20.720) con asesoría especializada.

Lo que NO funciona:
- "Limpieza de DICOM" pagada a empresas privadas: ESTAFA. Nadie puede "borrar" DICOM excepto pagando o por error de información.
- "DICOM falso" o portal alternativo: siempre verificar en equifax.cl
- Mezclar DICOM con CMF: son entidades distintas. CMF supervisa instituciones, no datos personales.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_8.pdf',
    title: 'Cooperativas de ahorro y crédito — qué son y cómo funcionan',
    document_type: 'guide',
    inline_text: `
COOPERATIVAS DE AHORRO Y CRÉDITO EN CHILE

Diferencia con bancos:
- Cooperativas: pertenecen a sus socios (asociados), reparten excedentes entre ellos.
- Bancos: pertenecen a accionistas, reparten utilidades.

Estructura legal:
- Reguladas por la Ley General de Cooperativas
- Las grandes (>$400.000 UF activos) son supervisadas por la CMF
- Las pequeñas son supervisadas por el Departamento de Cooperativas (Ministerio de Economía)

Tipos en Chile:
- Coopeuch: la más grande, ~1.6M socios, supervisada por CMF
- Coopnet
- Cooperativas locales / regionales / sectoriales (carabineros, profesores, etc.)

Productos típicos:
- Cuentas de ahorro
- Créditos de consumo (suelen tener tasas competitivas)
- Créditos hipotecarios
- Tarjetas de crédito (en algunas)

Ventajas vs bancos:
- Tasas a veces más bajas (especialmente en consumo)
- Excedentes anuales devueltos a socios (aunque modestos)
- Aprobación más flexible para perfiles no tradicionales
- Vínculo comunitario (algunas cooperativas son sectoriales)

Desventajas:
- Menos cajeros / sucursales
- Menos productos de inversión sofisticados
- Algunas operan solo en regiones específicas
- Si la cooperativa es pequeña, hay menos garantía estatal

Tus derechos como socio:
- Voto en asamblea anual (1 socio = 1 voto)
- Acceso a información financiera de la cooperativa
- Recibir excedentes proporcionales a tu uso de productos
- Salir libremente, recuperando tu cuota social

Reclamos:
- 1ro: cooperativa (área de socios)
- 2do: CMF (si está supervisada) o Departamento de Cooperativas
- 3ro: SERNAC en cualquier caso para temas de consumo
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_9.pdf',
    title: 'Bancos vs SaC vs Fintech — diferencias regulatorias',
    document_type: 'guide',
    inline_text: `
BANCOS, SACs Y FINTECHS — QUÉ TE PROTEGE EN CADA UNA

BANCOS:
- Supervisados por CMF (DL 3.500 + Ley General de Bancos)
- Garantía Estatal de Depósitos: hasta 200 UF (~$8M) por persona, en caso de quiebra
- Pueden recibir depósitos a la vista
- Sujetos a fuerte regulación de capital (Basilea III)
- Reclamos: vía CMF o SERNAC

SACs (Sociedades Anónimas Cerradas que ofrecen crédito sin captar depósitos):
- Supervisadas por CMF también (con marco distinto)
- Son emisores y operadores de tarjetas, financieras de consumo, leasing
- NO captan depósitos, solo prestan
- Garantía estatal: NO aplica (no aplica el seguro de depósitos)
- Ejemplos: Tanner Servicios Financieros, Forum Servicios Financieros
- Reclamos: vía CMF

FINTECHS (Ley 21.521):
- Registro obligatorio en CMF si ofrecen servicios definidos en la ley
- Tipos: crowdfunding, asesoría financiera, custodia digital, intermediación, sistemas alternativos de transacciones
- Capital mínimo y reglas operativas según tipo
- Garantía: separación de fondos del cliente (no se mezclan con los de la empresa)
- Si una fintech no está en el registro CMF: NO está regulada, opera a tu propio riesgo

CASAS COMERCIALES con tarjetas (Falabella, Cencosud, Ripley):
- Las tarjetas son un producto financiero supervisado por CMF
- Reclamos sobre la tarjeta: CMF
- Reclamos sobre el comercio (calidad del producto, devoluciones): SERNAC

CRÉDITO INFORMAL (gota a gota, prestamistas no registrados):
- NO regulados, operan al margen
- Tasas suelen exceder la TMC → ilegales
- Cobranza a veces con métodos abusivos → denunciable a Carabineros / SERNAC / CMF

Cómo identificar al regulador correcto:
- ¿Banco? → CMF + SERNAC
- ¿AFP? → Superintendencia de Pensiones
- ¿Compañía de seguros? → CMF
- ¿Telefonía / retail / e-commerce? → SERNAC
- ¿Empresa fintech? → CMF (si está en registro) o tribunales
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_10.pdf',
    title: 'AFP — fondo más conservador vs más agresivo',
    document_type: 'guide',
    inline_text: `
LOS 5 FONDOS DE AFP — A, B, C, D, E

Cada AFP ofrece 5 fondos con distinta exposición a renta variable (acciones):

Fondo A — MÁS RIESGO / MÁS RENTABILIDAD ESPERADA:
- 80% renta variable, 20% renta fija
- Volatilidad alta
- Apto para: jóvenes (20-35 años), tolerancia a fluctuaciones, plazo > 20 años para jubilar

Fondo B:
- 60% renta variable, 40% renta fija
- Menos volátil que A
- Apto para: 30-45 años, perfil moderado-agresivo

Fondo C:
- 40% renta variable, 60% renta fija
- Volatilidad media
- Apto para: 40-55 años, perfil moderado
- Es el fondo "default" que muchos tienen sin saberlo

Fondo D:
- 20% renta variable, 80% renta fija
- Estable, baja volatilidad
- Apto para: 50-65 años, perfil conservador

Fondo E — MENOS RIESGO / MENOS RENTABILIDAD ESPERADA:
- 5% renta variable, 95% renta fija
- Muy estable
- Apto para: cerca de jubilar (>60 años), o perfil ultra-conservador

REGLAS DE LA SUPERINTENDENCIA DE PENSIONES:

1. Asignación por edad (default si no eliges):
   - Hombres < 35: Fondo B
   - Hombres 35-55: Fondo C
   - Hombres > 55: Fondo D
   - Mujeres < 35: Fondo B
   - Mujeres 35-50: Fondo C
   - Mujeres > 50: Fondo D
   - Pensionados: Fondo E

2. Cambio de fondo:
   - 4 cambios al año GRATIS
   - Más cambios = costo
   - Toma 2-4 días hábiles efectivizar

3. Multifondos: puedes dividir tu cotización entre 2 fondos (ej: 50% B + 50% C)

LO QUE LA AFP NO PUEDE HACERTE:
- Cambiarte de fondo sin tu autorización (excepto el default por edad)
- Cobrar comisión por cambio de fondo (los 4 al año son gratis)
- Restringir cuándo puedes cambiar (es libre)
- Castigarte si cambias de AFP (también es libre)

ERROR COMÚN:
"Si cambio de fondo en momento malo, pierdo plata".
La realidad: cambiar de fondo no implica vender; es traspasar tus ahorros entre carteras de inversión gestionadas. Sí, hay efectos de timing si lo haces en pánico durante una caída.

Recomendación neutral (NO asesoría):
- Conoce tu fondo actual (la cartola lo dice)
- Revisa si calza con tu edad y plazo
- Si dudas, pide asesoría a un asesor previsional certificado (lista en https://www.spensiones.cl/)
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_11.pdf',
    title: 'Ley 21.521 Fintech — derechos del usuario de fintech',
    document_type: 'law',
    inline_text: `
LEY FINTECH 21.521 — PROTECCIÓN AL USUARIO

Vigente desde febrero 2023, con reglamentación gradual hasta 2026.

QUÉ REGULA:
1. Plataformas de financiamiento colectivo (crowdfunding)
2. Sistemas alternativos de transacciones (intermediación)
3. Asesoría financiera digital (robo-advisors)
4. Custodia digital de instrumentos financieros
5. Enrutamiento de órdenes
6. Sistema Open Finance

REGISTRO OBLIGATORIO:
- Toda fintech que ofrezca estos servicios debe registrarse en la CMF
- El registro es PÚBLICO: https://www.cmfchile.cl/portal/principal/613/w3-channel.html
- Si una fintech NO está en el registro y ofrece estos servicios, opera ilegalmente

PROTECCIÓN AL USUARIO:
1. INFORMACIÓN CLARA: la fintech debe entregar términos en lenguaje simple, no técnico
2. SEPARACIÓN DE FONDOS: tus fondos en custodia NO se mezclan con los de la fintech (en caso de quiebra de la fintech, tus fondos están protegidos)
3. RESOLUCIÓN DE RECLAMOS: misma vía CMF
4. CANCELACIÓN GRATUITA: puedes salir de la plataforma cuando quieras
5. REGISTRO DE OPERACIONES: la fintech debe darte historial completo

OPEN FINANCE (componente de la ley):
- Obligación de bancos e instituciones financieras de compartir datos del cliente con su autorización
- Vía APIs estándar
- Te permite que terceros (apps, fintech) accedan a tu información para ofrecerte productos
- TÚ AUTORIZAS, TÚ REVOCAS
- Implementación gradual 2025-2026

REGLAS PARA CROWDFUNDING:
- Límite por inversión: 100 UF por proyecto si eres no-calificado
- Información obligatoria del proyecto
- Plataforma debe verificar al emisor
- Riesgo de pérdida total del capital invertido

REGLAS PARA ASESORÍA DIGITAL:
- Algoritmo debe estar documentado y auditado
- Conflictos de interés deben ser declarados
- No puede prometer rentabilidad

QUÉ HACER SI UNA FINTECH TE FALLA:
1. Reclamo a la fintech (10 días hábiles)
2. Si no responden o respuesta insatisfactoria → CMF
3. SERNAC también puede mediar para temas de consumo
4. Si hay delito (estafa, apropiación de fondos): denuncia a Fiscalía + Carabineros / PDI

QUÉ HACER SI UNA "FINTECH" NO ESTÁ REGISTRADA:
- NO uses sus servicios
- Reporta a CMF como denuncia
- Si ya operaste con ellos: documenta todo, reclama, considera acción judicial
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_12.pdf',
    title: 'Cobranza extrajudicial — qué es legal y qué no',
    document_type: 'guide',
    inline_text: `
COBRANZA EXTRAJUDICIAL — TUS DERECHOS

Cuando atrasas pagos, la institución acreedora puede iniciar cobranza extrajudicial. Esto está regulado por la Ley 19.496 (artículos 37 y siguientes).

GASTOS DE COBRANZA — LÍMITES LEGALES:

Para deudas en mora:
- Deudas hasta 10 UF: gastos de cobranza máximos = 9% del saldo deudor
- Deudas 10-50 UF: máximos = 6%
- Deudas > 50 UF: máximos = 3%

NO se puede cobrar gastos por:
- Mora menor a 20 días
- Gestiones que no se hayan realizado realmente
- Notificaciones por canales no autorizados (WhatsApp sin tu consentimiento, llamadas a horas inhábiles, etc.)

QUÉ ES LEGAL EN COBRANZA:
- Llamadas telefónicas en horario hábil (8am-8pm de lunes a sábado, no domingos ni festivos)
- Cartas formales a tu dirección
- Visitas domiciliarias en horario hábil (con identificación clara)
- Notificación a tu dirección laboral SOLO si la pusiste como contacto comercial
- Reportar a DICOM tras 30 días de mora

QUÉ ES ILEGAL:
- Llamadas a horas inhábiles (>8pm, antes de 8am, domingos, festivos)
- Acoso telefónico (más de 3 llamadas al día)
- Amenazas de violencia, despido, o daño reputacional
- Contactar a tu familia, vecinos, jefe, sin tu autorización (salvo cuando son codeudores)
- Hostigamiento por redes sociales (publicar tu deuda, etiquetarte públicamente)
- Cobrar gastos de cobranza superiores a los legales
- Obligarte a pagar dentro de un plazo no razonable
- Bloquear tu acceso a otros servicios no relacionados con la deuda

QUÉ HACER SI TE COBRAN ABUSIVAMENTE:
1. Documenta: graba llamadas (Chile permite grabación si tú estás en la conversación), guarda mensajes
2. Reclamo formal a la institución acreedora (10 días)
3. SERNAC: muy efectivo en estos casos, hace mediación
4. CMF: si la institución es bancaria, fintech, AFP o seguros
5. PDI / Fiscalía: si hay amenazas o intimidación graves (delito)
6. Acción judicial: si hay perjuicio (daño moral, daño económico)

DEUDAS PRESCRITAS:
- En general, una deuda prescribe a los 3 años (Código Civil)
- Si la deuda prescribió y te cobran, es ILEGAL
- Si te demandan post-prescripción, defiendete en juicio
- DICOM debe limpiar deudas prescritas previa solicitud
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_13.pdf',
    title: 'Crédito automotriz — guía del consumidor',
    document_type: 'guide',
    inline_text: `
CRÉDITO AUTOMOTRIZ — TODO LO QUE DEBES SABER

Tipos en Chile:
1. Crédito automotriz tradicional (banco): tasa fija, plazo 36-60 meses, pie 10-30%
2. Leasing automotriz: arriendas con opción de compra al final, contable atractivo para empresas
3. Crédito con casa comercial / concesionario: tasa generalmente más alta
4. Smart Buy / Leaseback: comprar con opción de devolución a 36 meses

VARIABLES CLAVE:

Tasa: típicamente 0.8% - 1.8% mensual (~10%-22% anual)
Plazo: 24-60 meses (más corto = cuota mayor pero menos intereses)
Pie: 10-30% del valor (más pie = mejor tasa generalmente)

CAE en automotriz:
- Por ley debe estar en la hoja resumen
- Suele ser 15%-22% anual
- Diferencia con tasa nominal: comisiones + seguros incluidos

Seguros típicos (verifica si son obligatorios u opcionales):
- Desgravamen: OBLIGATORIO en la mayoría
- Robo y daños (todo riesgo): OBLIGATORIO si financias > 70%
- Cesantía: OPCIONAL
- Asistencia mecánica: OPCIONAL

DERECHOS DEL CONSUMIDOR:

1. Comparar concesionario vs banco directo: tu derecho. La diferencia de tasa puede ser 3-5 puntos.
2. Elegir aseguradora: sí, también para automotriz. Algunas concesionarias dicen que no — es ilegal.
3. Pre-pago: 1% comisión máxima.
4. Refinanciar: cambiar de banco si después encuentras mejor tasa.
5. Inspección: tienes derecho a 1 inspección post-entrega antes de firmar el crédito.

LO QUE LA CONCESIÓN NO PUEDE HACER:
- Imponerte la aseguradora del concesionario
- Cobrar gastos no estipulados en el contrato
- Negar pre-pago o refinanciamiento
- Ocultar la CAE real
- Vender autos con vicios ocultos sin informar

VICIOS REDHIBITORIOS (defectos ocultos):
- Si descubres un defecto que no podías ver al comprar, tienes 6 meses para reclamar (Código Civil)
- Solución: rebaja del precio o devolución
- En auto usado, la responsabilidad del vendedor es relativa pero existe

QUÉ REVISAR ANTES DE FIRMAR:
1. Tasa nominal mensual + CAE anual
2. Plazo y número de cuotas
3. Cuota mensual + cuota final (si hay smart buy)
4. Pie pagado
5. Seguros incluidos (cuáles son obligatorios)
6. Comisiones por pre-pago, refinanciamiento, mora
7. Garantía del vehículo (en auto nuevo)

RECLAMOS:
- 1ro: institución (banco / financiera)
- 2do: CMF si es bancaria / fintech / financiera regulada; SERNAC en otros casos
- Para defectos del auto (no del crédito): SERNAC + acción civil
`
  }
];

const TARGET_TOKENS = 512;
const OVERLAP = 50;

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function chunk(text: string): string[] {
  const paras = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (approxTokens(cur + '\n\n' + p) > TARGET_TOKENS && cur) {
      out.push(cur.trim());
      cur = cur.split(/\s+/).slice(-OVERLAP).join(' ') + '\n\n' + p;
    } else {
      cur = cur ? cur + '\n\n' + p : p;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((c) => approxTokens(c) >= 50);
}

async function ingest(d: Doc): Promise<void> {
  const sb = supabase();
  const { data: reg, error: regErr } = await sb
    .from('regulations')
    .upsert(
      {
        source_url: d.source_url,
        title: d.title,
        document_type: d.document_type,
        raw_text: d.inline_text.trim(),
        last_indexed_at: new Date().toISOString()
      },
      { onConflict: 'source_url' }
    )
    .select('id')
    .single();
  if (regErr || !reg) throw new Error(regErr?.message);

  await sb.from('embeddings').delete().eq('regulation_id', reg.id);

  const chunks = chunk(d.inline_text.trim());
  logger.info({ doc: d.title, chunks: chunks.length }, 'embedding');

  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(slice);
    const rows = slice.map((c, j) => ({
      regulation_id: reg.id,
      chunk_index: i + j,
      chunk_text: c,
      embedding: vectors[j],
      metadata: { document_type: d.document_type }
    }));
    const { error } = await sb.from('embeddings').insert(rows);
    if (error) throw new Error(error.message);
  }
}

async function main(): Promise<void> {
  logger.info({ count: DOCS.length }, 'ingesting extra corpus');
  for (const d of DOCS) {
    try {
      await ingest(d);
      logger.info({ doc: d.title }, 'OK');
    } catch (e) {
      logger.error({ err: (e as Error).message, doc: d.title }, 'failed');
    }
  }
  logger.info('extra corpus done');
  process.exit(0);
}

main().catch((e) => { logger.fatal({ err: e.message }, 'fatal'); process.exit(1); });
