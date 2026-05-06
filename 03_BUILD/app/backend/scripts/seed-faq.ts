/**
 * Seed de FAQ pre-respondidas. Las top 25 preguntas con respuesta canónica.
 * Sirve para responder al instante las consultas más comunes (latencia ~200ms vs 5s).
 */
import { upsertFaq } from '../src/services/faq.js';
import { applyDisclaimer } from '../src/agents/guardrails.js';
import { logger } from '../src/lib/logger.js';

interface FaqSeed {
  question: string;
  answer: string;
  citations: Array<{ title: string; url: string }>;
}

const CMF_EDUCA = 'https://www.cmfchile.cl/educa/621/w3-channel.html';
const LEY_CONSUMIDOR = 'https://www.bcn.cl/leychile/navegar?idNorma=61438';
const LEY_FINTECH = 'https://www.bcn.cl/leychile/navegar?idNorma=1188900';

const FAQ: FaqSeed[] = [
  {
    question: '¿Qué es la UF?',
    answer:
      'La UF (Unidad de Fomento) es una unidad de cuenta reajustable según el IPC. Se actualiza diariamente y se usa especialmente en créditos hipotecarios y operaciones financieras de largo plazo. Su función es proteger el valor real del dinero contra la inflación.',
    citations: [{ title: 'CMF Educa — Glosario', url: CMF_EDUCA }]
  },
  {
    question: '¿Qué es el CAE?',
    answer:
      'El CAE (Carga Anual Equivalente) es el indicador oficial que muestra el costo TOTAL anual de un crédito en porcentaje, incluyendo intereses, comisiones, seguros y todos los gastos. Sirve para comparar ofertas: a CAE igual, dos créditos cuestan lo mismo aunque la "tasa" suene distinta.',
    citations: [{ title: 'Ley 19.496 Art. 17B', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Qué es DICOM?',
    answer:
      'DICOM es un registro privado de información comercial (gestionado por Equifax) donde aparecen tus deudas vencidas. Tienes derecho a una hoja de información comercial gratis al año en equifax.cl. Si pagaste una deuda, debe salir en máximo 30 días. Si una deuda no es tuya o ya pagada, puedes pedir corrección formal.',
    citations: [{ title: 'Ley 19.628 sobre datos personales', url: 'https://www.bcn.cl/leychile/navegar?idNorma=141599' }]
  },
  {
    question: '¿Qué es la TPM?',
    answer:
      'La TPM (Tasa de Política Monetaria) es la tasa de referencia que fija el Banco Central de Chile. Influye en las tasas de mercado: cuando sube, los créditos se vuelven más caros; cuando baja, más baratos.',
    citations: [{ title: 'Banco Central de Chile', url: 'https://www.bcentral.cl' }]
  },
  {
    question: '¿Qué es la TMC?',
    answer:
      'La TMC (Tasa Máxima Convencional) es el límite legal de tasa de interés que se puede cobrar en un crédito. Se calcula a partir de la tasa de interés corriente que publica mensualmente la CMF, aumentada en 50%. Cobrar sobre la TMC es ilegal: la sanción es la reducción al interés corriente más devolución del exceso reajustado.',
    citations: [{ title: 'Ley 18.010 Art. 6 bis', url: 'https://www.bcn.cl/leychile/navegar?idNorma=29438' }]
  },
  {
    question: '¿Qué es el IPC?',
    answer:
      'El IPC (Índice de Precios al Consumidor) mide la variación promedio de precios de una canasta representativa de bienes y servicios consumidos por hogares en Chile. Lo publica el INE mensualmente. Cuando el IPC sube, tu poder de compra cae si tu sueldo no se reajusta.',
    citations: [{ title: 'INE Chile', url: 'https://www.ine.cl' }]
  },
  {
    question: '¿Cómo verifico si un banco está supervisado por la CMF?',
    answer:
      'En el sitio oficial de la CMF tienes el listado público de Entidades Supervisadas. Si una entidad ofrece créditos o seguros y NO aparece ahí, opera fuera del marco regulatorio. Bancos populares supervisados: Banco de Chile, Santander, BCI, BancoEstado, Itaú, Falabella, Ripley, Scotiabank, Security, Internacional, Consorcio, BICE, HSBC, Edwards. Cooperativas grandes como Coopeuch también están supervisadas.',
    citations: [{ title: 'CMF — Entidades Supervisadas', url: CMF_EDUCA }]
  },
  {
    question: '¿Tengo derecho a retracto en un crédito?',
    answer:
      'Sí, si firmaste el crédito a distancia (online, teléfono) puedes anular sin expresión de causa dentro de 10 días contados desde la celebración del contrato. Aplica para créditos de hasta 100 UF. NO aplica para hipotecarios ni montos mayores. Solo debes restituir lo recibido más intereses calculados desde el día de la entrega.',
    citations: [{ title: 'Ley 19.496 Art. 17K', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Puedo prepagar mi crédito sin penalidad?',
    answer:
      'Sí, tienes derecho a pagar anticipadamente, total o parcialmente. La comisión máxima por prepago es 1% del capital prepagado para créditos hasta 5.000 UF, y 1.5% para mayores. La institución no puede negarse al prepago ni cobrar más allá de ese tope. Tienes derecho a recálculo de la tabla de pagos si es prepago parcial.',
    citations: [{ title: 'Ley 19.496 Art. 17L', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Tengo que contratar el seguro con la compañía del banco?',
    answer:
      'No. Cuando un crédito requiere seguro (desgravamen, incendio en hipotecarios), tú eliges la compañía aseguradora. La institución financiera NO PUEDE imponerte la suya ni condicionar el otorgamiento del crédito a contratar con su aseguradora. Si te lo intentan imponer, es ilegal y puedes reclamar a CMF y SERNAC.',
    citations: [{ title: 'Ley 19.496 Art. 17D', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Cómo presento un reclamo a la CMF?',
    answer:
      'Primero debes reclamar formalmente a la institución (banco, AFP, fintech, seguros). Tienen 10 días hábiles para responder. Si no responden o la respuesta es insatisfactoria, presenta tu reclamo en cmfchile.cl → Reclamos en línea. Necesitas: copia cédula, identificación de la institución, descripción del problema, copia de contratos, comprobante del reclamo previo. La CMF tiene 15 días hábiles para gestionar.',
    citations: [{ title: 'CMF — Reclamos', url: 'https://www.cmfchile.cl/portal/principal/613/w3-channel.html' }]
  },
  {
    question: 'Mi banco me cobró un seguro que no autoricé, ¿qué hago?',
    answer:
      'Por ley (Art. 17D Ley 19.496), todo seguro asociado a un crédito requiere autorización expresa tuya (firma, grabación o email). Pídele al banco el comprobante de aceptación. Si no existe → tienes derecho a reembolso completo de TODO lo cobrado. Pasos: 1) Reclamo formal al banco con copia de cartola y solicitud del comprobante; 2) Si no responden o niegan: reclamo CMF; 3) En paralelo, SERNAC también recibe estos casos.',
    citations: [{ title: 'Ley 19.496 Art. 17D', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Qué pasa si no pago la cuota de mi tarjeta?',
    answer:
      'Después de 30 días de mora, la institución puede reportarte a DICOM. Antes de eso, te cobrarán intereses moratorios (típicamente 50% adicional sobre la tasa pactada). La institución debe contactarte por canales razonables (no acoso). Si no logras pagar, contacta al banco para repactar antes de los 30 días — es mejor que figurar en DICOM.',
    citations: [{ title: 'Ley 19.628 + LPC Art. 37', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Cuántas veces al año puedo cambiar de fondo en mi AFP?',
    answer:
      'Puedes cambiar de fondo (entre A, B, C, D, E) hasta 4 veces al año GRATIS. A partir del quinto cambio, tiene un costo. Cambiar de AFP también es libre y gratuito. Los cambios se efectivizan en 2-4 días hábiles. Considera tu edad y horizonte para decidir el fondo: A = más riesgo y rentabilidad esperada, E = más estable.',
    citations: [{ title: 'Superintendencia de Pensiones', url: 'https://www.spensiones.cl' }]
  },
  {
    question: 'Me llaman ofreciendo crédito de un banco que no aparece en CMF, ¿es estafa?',
    answer:
      '🚨 Probablemente sí. Si un "banco" no figura en la lista oficial de la CMF, no está autorizado para operar en Chile. Señales de estafa que coinciden: piden depósito previo o comisión de gestión, apuran tu decisión, solicitan datos sensibles (RUT, claves, fotos de tarjeta) por teléfono. Bloquea el número, no transfieras nada y denuncia: 1) PDI/Carabineros, 2) CMF como denuncia (cmfchile.cl), 3) Reporta el número en redes para alertar a otros.',
    citations: [{ title: 'CMF — Listado entidades supervisadas', url: 'https://www.cmfchile.cl/portal/principal/613/w3-channel.html' }]
  },
  {
    question: '¿Qué hago si recibo amenazas en cobranza?',
    answer:
      'La cobranza con amenazas, acoso, llamadas en horarios inhábiles (más de 8pm, antes de 8am, domingos, festivos) o contacto a tu familia/jefe sin tu autorización es ILEGAL. Pasos: 1) Documenta (graba llamadas — Chile permite si tú estás en la conversación, guarda mensajes); 2) Reclama al SERNAC (es muy efectivo en estos casos, hace mediación); 3) Si hay amenazas graves, denuncia a Carabineros/PDI por delito; 4) CMF si el cobrador es banco/fintech regulada.',
    citations: [{ title: 'Ley 19.496 Art. 37', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Una empresa puede cobrarme intereses superiores a la tasa máxima legal?',
    answer:
      'No. Cobrar sobre la TMC es ilegal. La sanción es: reducción de la tasa al interés corriente vigente al momento del contrato + devolución de lo cobrado en exceso reajustado. Si descubres que tu crédito tiene tasa superior a la TMC, reclama formalmente y solicita ajuste. Si no responden: CMF y eventualmente acción judicial.',
    citations: [{ title: 'Ley 18.010 Art. 8', url: 'https://www.bcn.cl/leychile/navegar?idNorma=29438' }]
  },
  {
    question: '¿Cuándo prescribe una deuda?',
    answer:
      'En general, las deudas civiles prescriben a los 3 años desde que se hizo exigible (Código Civil). Las deudas tributarias tienen plazos distintos. Si una deuda prescribió y aún te cobran, eso es ilegal. Si te demandan post-prescripción, debes alegarla en juicio (no se aplica de oficio). DICOM debe limpiar deudas prescritas previa solicitud.',
    citations: [{ title: 'Código Civil', url: 'https://www.bcn.cl/leychile/navegar?idNorma=172986' }]
  },
  {
    question: '¿Qué es Open Finance?',
    answer:
      'Open Finance (Ley 21.521) es un sistema obligatorio de intercambio estandarizado de datos financieros entre instituciones, con tu autorización expresa, vía APIs. Te permite: 1) Pedir a tu banco que comparta tu historial con otra institución, 2) Que apps comparen ofertas usando tus datos reales, 3) Ver todas tus cuentas en una sola app. Implementación gradual 2025-2026. TÚ autorizas y TÚ revocas en cualquier momento.',
    citations: [{ title: 'Ley 21.521 Fintech', url: LEY_FINTECH }]
  },
  {
    question: '¿Qué es una fintech regulada?',
    answer:
      'Una fintech regulada es la que está inscrita en el Registro de Prestadores de Servicios Financieros que mantiene la CMF (Ley 21.521). Eso te garantiza: información clara, separación de tus fondos vs los de la empresa, gestión de conflictos de interés, y vía CMF para reclamos. Si una fintech NO está en el registro y ofrece estos servicios, opera ilegalmente — no uses sus servicios.',
    citations: [{ title: 'CMF — Registro Prestadores', url: 'https://www.cmfchile.cl/portal/principal/613/w3-channel.html' }]
  },
  {
    question: '¿Eres asesor financiero?',
    answer:
      'No. Soy un asistente educativo que explica regulación financiera y derechos del consumidor en Chile, citando datos públicos de la CMF. NO doy asesoría financiera personalizada, NO recomiendo productos ni decisiones de inversión. Para decisiones específicas necesitas un asesor financiero certificado por la CMF.',
    citations: [{ title: 'Quiénes somos', url: 'https://financia-chile.cl' }]
  },
  {
    question: '¿Quién eres?',
    answer:
      'Soy FinancIA Chile, un asistente educativo de IA creado por QUANT24. Mi rol es traducir información financiera y regulatoria de la CMF al lenguaje cotidiano. Respondo gratis por Instagram DM y WhatsApp. Cito siempre la fuente oficial. No doy asesoría financiera, solo educación.',
    citations: [{ title: 'FinancIA Chile', url: 'https://financia-chile.cl' }]
  },
  {
    question: '¿Cuánto cuestas?',
    answer:
      '¡Soy gratis! Para siempre. No tenemos pauta, no vendemos tus datos, no hacemos upsell. La operación cuesta menos de $0.02 USD por conversación gracias a una arquitectura optimizada (modelos pequeños + caching agresivo) y datos abiertos CMF. El costo lo cubre QUANT24 mientras logremos sostenerlo.',
    citations: [{ title: 'About QUANT24', url: 'https://quant24.cl' }]
  },
  {
    question: '¿Cuánto cuesta cancelar mi tarjeta de crédito?',
    answer:
      'Gratis. Tienes derecho a cancelar la tarjeta en cualquier momento sin penalidad (Ley 19.496). Si tienes saldo pendiente debes pagarlo, pero la cancelación en sí no tiene costo. Pasos: 1) Solicita la cancelación por escrito (mail o sucursal); 2) Pide carta de cierre confirmando que la cuenta está saldada; 3) Verifica que no quede ningún cobro automático asociado; 4) En 30 días la cancelación debe estar reflejada en tu cartola.',
    citations: [{ title: 'Ley 19.496', url: LEY_CONSUMIDOR }]
  },
  {
    question: '¿Cuánto puede cobrarme una institución por gastos de cobranza?',
    answer:
      'Los gastos de cobranza extrajudicial están limitados por ley (Ley 19.496 Art. 37): hasta 9% del saldo deudor para deudas hasta 10 UF; 6% para deudas entre 10-50 UF; 3% para deudas mayores a 50 UF. NO se puede cobrar gastos por mora menor a 20 días. Si te cobran más que esos topes, es ilegal y puedes reclamarlo.',
    citations: [{ title: 'Ley 19.496 Art. 37', url: LEY_CONSUMIDOR }]
  }
];

async function main(): Promise<void> {
  logger.info({ count: FAQ.length }, 'seeding FAQ cache');
  let i = 0;
  for (const f of FAQ) {
    i++;
    try {
      await upsertFaq({
        question: f.question,
        answer: applyDisclaimer(f.answer),
        citations: f.citations
      });
      process.stdout.write(`[${i}/${FAQ.length}] ✅ ${f.question}\n`);
    } catch (e) {
      process.stdout.write(`[${i}/${FAQ.length}] ❌ ${f.question}: ${(e as Error).message}\n`);
    }
  }
  logger.info('FAQ seed done');
  process.exit(0);
}

main().catch((e) => { logger.fatal({ err: e.message }, 'fatal'); process.exit(1); });
