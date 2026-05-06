/**
 * Script de ingesta de corpus CMF.
 * Uso: npm run ingest:cmf -- --source seed
 *
 * `seed` = corpus inicial mínimo (10 docs hardcoded para MVP)
 * `full` = scrape Compendio CMF completo (Q2)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import pdf from 'pdf-parse';
import { supabase } from '../src/lib/supabase.js';
import { embedBatch } from '../src/lib/google-embeddings.js';
import { logger } from '../src/lib/logger.js';

interface SeedDoc {
  source_url: string;
  title: string;
  document_type: 'circular' | 'norma' | 'guide' | 'law' | 'glossary';
  effective_date?: string;
  // Si es texto inline (para MVP rápido)
  inline_text?: string;
  // O URL a PDF
  pdf_url?: string;
}

const SEED: SeedDoc[] = [
  {
    source_url: 'https://www.cmfchile.cl/educa/621/articles-1131_recurso_1.pdf',
    title: 'CMF Educa — Glosario Financiero',
    document_type: 'glossary',
    inline_text: `
GLOSARIO FINANCIERO CMF (extracto)

UF (Unidad de Fomento): unidad de cuenta reajustable según el IPC. Se utiliza como medida de valor en operaciones financieras y créditos hipotecarios. Su valor se actualiza diariamente.

CAE (Carga Anual Equivalente): indicador del costo total de un crédito expresado en porcentaje anual, incluye intereses, comisiones, seguros y gastos asociados. Permite comparar ofertas de distintas instituciones.

TIR (Tasa Interna de Retorno): tasa que iguala el valor presente de los flujos futuros de una inversión a su costo inicial. Útil para comparar rentabilidad de instrumentos.

TPM (Tasa de Política Monetaria): tasa de referencia fijada por el Banco Central de Chile. Influencia las tasas de mercado.

DICOM: registro de morosidad comercial. Estar en DICOM dificulta el acceso a productos financieros. Tienes derecho a una hoja de información comercial gratuita una vez al año.

IPC (Índice de Precios al Consumidor): mide la variación promedio de precios de una canasta representativa de bienes y servicios consumidos por hogares en Chile. Publicado por el INE.

DICOM y derechos del consumidor: si una deuda fue pagada, tienes derecho a que sea retirada del registro en un plazo máximo de 30 días corridos.

Tasa Máxima Convencional (TMC): tasa de interés máxima permitida por ley. Se calcula a partir de la tasa de interés corriente que publica mensualmente la CMF. Cobrar sobre la TMC es ilegal.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_pdf.pdf',
    title: 'Reglamento operaciones de crédito de dinero (Ley 18.010)',
    document_type: 'law',
    inline_text: `
Ley 18.010 — Operaciones de crédito de dinero (extracto relevante para consumidores).

ARTÍCULO 6 — Tasa de interés convencional. Es la que las partes acuerdan, sin perjuicio de los límites establecidos en esta ley. La estipulación de un interés superior al máximo convencional será reducida al interés corriente que rija al momento de la convención.

ARTÍCULO 6 BIS — Tasa máxima convencional (TMC). La CMF determina la tasa de interés corriente con periodicidad mensual y la publica. La TMC es la TIC aumentada en un 50%. Para créditos en montos menores a 200 UF, la fórmula varía y considera además el plazo del crédito.

ARTÍCULO 8 — Pacto de un interés superior al máximo convencional. La sanción es la reducción al interés corriente, además de devolver lo cobrado en exceso reajustado.

Plazos: si el crédito es a más de un año, la tasa se considera en términos anuales. Si es a menor plazo, también pero mensualizada.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_1.pdf',
    title: 'Ley 19.496 — Derechos del Consumidor (módulo financiero)',
    document_type: 'law',
    inline_text: `
Ley 19.496 (LPC) — Módulo Financiero (Título IV).

ARTÍCULO 17 B — El proveedor financiero deberá proporcionar al consumidor una hoja resumen del producto que incluya: monto del crédito, tasa de interés, CAE, plazos, total a pagar, y todos los gastos.

ARTÍCULO 17 C — Información obligatoria en publicidad: monto crédito, plazo, número de cuotas, tasa, CAE, total a pagar.

ARTÍCULO 17 K — Derecho a retracto: el consumidor puede dejar sin efecto, sin expresión de causa, dentro de 10 días contados desde la celebración del contrato, los créditos celebrados a distancia. Solo aplica para créditos de hasta 100 UF y excluye créditos hipotecarios.

ARTÍCULO 17 L — Prepago. El consumidor tiene derecho a pagar anticipadamente el crédito, total o parcialmente, sin más comisiones que las pactadas en el contrato (que no pueden exceder el 1,5% del capital prepagado para créditos sobre 5.000 UF y 1% para los menores).

ARTÍCULO 17 D — Seguros asociados al crédito: el consumidor tiene derecho a contratar el seguro con la compañía que estime conveniente. La institución no puede condicionar el otorgamiento.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_pdf2.pdf',
    title: 'Procedimiento de Reclamos CMF',
    document_type: 'guide',
    inline_text: `
PROCEDIMIENTO DE RECLAMOS ANTE LA CMF

Paso 1: Reclamo previo al proveedor. El consumidor debe primero reclamar formalmente a la institución (banco, cooperativa, AFP, compañía de seguros, fintech regulada).

Paso 2: Si la institución no responde en 10 días hábiles, o la respuesta es insatisfactoria, el consumidor puede acudir a la CMF.

Paso 3: Presentación a CMF. Por canales:
- En línea: https://www.cmfchile.cl/portal/principal/613/w3-channel.html
- Presencial: oficinas regionales
- Por escrito: correo certificado a oficina central

Documentos requeridos:
- Copia de cédula
- Identificación de la institución
- Descripción del problema
- Copia de contratos involucrados
- Comprobante de reclamo previo a la institución

Plazo CMF: 15 días hábiles para gestionar.

CMF no es tribunal: no impone sanciones al consumidor ni resuelve montos. Su rol es supervisar y mediar. Para sanciones procede vía judicial.

Alternativa paralela: SERNAC también recibe reclamos de productos financieros y puede mediar.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_recurso_2.pdf',
    title: 'Verificación de instituciones supervisadas CMF',
    document_type: 'guide',
    inline_text: `
CÓMO VERIFICAR SI UNA INSTITUCIÓN ESTÁ SUPERVISADA POR LA CMF

La CMF supervisa: bancos, cooperativas de ahorro y crédito grandes, sociedades de leasing, factoring no bancario, AFP, compañías de seguros, corredores de bolsa, fondos mutuos, fondos de inversión, cajas de compensación, emisores y operadores de tarjetas, fintech reguladas (post-Ley 21.521).

Si una entidad ofrece créditos, depósitos, seguros o productos de inversión y NO está supervisada, opera fuera del marco regulatorio. Esto significa:
- No tiene garantía estatal en caso de quiebra
- No tiene obligación de informar tasa CAE
- No puede ser fiscalizada por la CMF
- Puede ser una operación informal o estafa

Cómo verificar: sitio CMF → Listado de Entidades Supervisadas (público, gratuito).
URL directo: https://www.cmfchile.cl/portal/principal/613/w3-channel.html

Bancos populares supervisados (lista parcial): Banco de Chile, Santander Chile, BCI, BancoEstado, Banco Itaú, Banco Falabella, Banco Ripley, Scotiabank, Banco Security, Banco Internacional, Banco Consorcio, Banco BICE, HSBC, Banco Edwards.

Si te llaman ofreciendo crédito de un "banco" cuyo nombre no aparece en la lista oficial: probablemente es estafa.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-21521_pdf.pdf',
    title: 'Ley Fintech 21.521 — Información para consumidores',
    document_type: 'law',
    inline_text: `
LEY 21.521 — FINTECH (vigente desde febrero 2023, reglamentación 2024-2025).

OBJETO: regular plataformas tecnológicas que prestan servicios financieros: crowdfunding, asesoría financiera digital, custodia, intermediación, y otras.

REGISTRO: las fintech reguladas deben inscribirse en el Registro de Prestadores de Servicios Financieros que mantiene la CMF.

PROTECCIÓN AL CONSUMIDOR:
- Información clara: cualquier servicio fintech debe entregar términos en lenguaje simple
- Gestión de conflictos de interés: la fintech debe informar y gestionar
- Resolución de reclamos: misma vía CMF + SERNAC
- Custodia de fondos: separación de cuentas (los fondos del cliente no se mezclan con los del proveedor)

OPEN FINANCE (en implementación 2025-2026): obligación de instituciones financieras de compartir datos del cliente con su autorización a través de APIs estándar. Le da al consumidor portabilidad real de su información financiera.

Una fintech NO regulada por CMF significa que opera fuera del marco — el riesgo del consumidor es máximo.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-25395_pdf3.pdf',
    title: 'Cobros indebidos y seguros no autorizados',
    document_type: 'guide',
    inline_text: `
COBROS INDEBIDOS

Casos típicos:
- Comisión por mantención no informada
- Cargo por uso de cajero no contemplado en contrato
- Seguro contratado sin autorización expresa del consumidor
- Cuota anual de tarjeta cobrada en periodo gratuito
- Cargo por servicio no solicitado

Tu derecho (Ley 19.496):
- Pedir devolución íntegra reajustada
- Cancelar el producto/servicio sin penalización
- Si la institución no devuelve en 10 días hábiles → reclamo CMF + SERNAC

SEGUROS NO AUTORIZADOS

Si encuentras un seguro asociado a tu crédito o tarjeta que NO autorizaste expresamente:
1. La institución debe demostrar la autorización (firma física, firma digital, grabación). Si no la tiene, debe devolver TODO lo cobrado.
2. Tienes derecho a cambiar la compañía aseguradora, si el crédito requería seguro.
3. La institución NO puede condicionar el crédito a contratar el seguro con ellos (Art. 17 D LPC).

Documentación a guardar:
- Cartola con cargo subrayado
- Contrato original
- Solicitud al banco pidiendo el comprobante de autorización
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-21521_pdf2.pdf',
    title: 'CAE — Carga Anual Equivalente',
    document_type: 'guide',
    inline_text: `
CAE — CARGA ANUAL EQUIVALENTE

Definición: indicador que expresa en porcentaje anual el COSTO TOTAL de un crédito, incluyendo:
- Tasa de interés nominal
- Comisiones obligatorias
- Seguros obligatorios
- Gastos notariales y operacionales

Por qué importa: dos créditos con la misma "tasa" pueden tener CAE muy distintos si uno tiene seguros o comisiones que el otro no.

Regla: a CAE igual, dos créditos cuestan lo mismo (en términos anuales). Comparar siempre por CAE, NO por tasa de interés.

Obligación legal (Ley 19.496 Art. 17 B): toda oferta de crédito debe mostrar el CAE de forma clara y destacada en publicidad y en hoja resumen.

Cómo verificar tu CAE:
- Pide la hoja resumen al banco
- El CAE debe coincidir aproximadamente con: ((Total a pagar - Capital) / Capital) elevado a 12/n - 1, donde n es el plazo en meses.
- Para verificación exacta, simulador CMF Educa: https://www.cmfchile.cl/educa/621/w3-propertyvalue-12434.html

Si tu CAE es notoriamente distinto al "cobro" mensual: pide explicación por escrito al banco.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-21521_pdf3.pdf',
    title: 'AFP y derechos del afiliado',
    document_type: 'guide',
    inline_text: `
AFP — DERECHOS DEL AFILIADO

Sistema obligatorio de capitalización individual (DL 3.500). 6 AFP supervisadas por la CMF en 2026: Habitat, Cuprum, Provida, Capital, Modelo, Plan Vital, Uno.

DERECHOS:
- Cambio de AFP: gratuito y sin trámites complejos. Una vez al año pleno derecho.
- Cambio de fondo (A, B, C, D, E): hasta 4 cambios de fondo por año sin costo
- Información: la AFP debe enviar cartola cada 3 meses (digital ok) con: saldo, rentabilidad, comisión cobrada
- Consulta libre del saldo en línea, 24/7

COMISIONES:
- Cada AFP cobra una comisión sobre la remuneración (no sobre el saldo)
- Las comisiones se publican mensualmente en el sitio de la Superintendencia de Pensiones
- AFP Modelo y AFP Uno suelen tener comisión más baja que las tradicionales

QUEJAS Y RECLAMOS:
- Primero: a la AFP (por sitio web o sucursal)
- Si no responden en 10 días hábiles: Superintendencia de Pensiones (no CMF, ojo)
- URL: https://www.spensiones.cl/
- En paralelo: SERNAC

PORTABILIDAD POST-LEY: tu saldo se mueve contigo entre AFP automáticamente. La rentabilidad histórica NO se "pierde" al cambiar.
`
  },
  {
    source_url: 'https://www.cmfchile.cl/portal/principal/613/articles-21521_pdf4.pdf',
    title: 'Estafas financieras comunes en Chile y cómo identificarlas',
    document_type: 'guide',
    inline_text: `
ESTAFAS FINANCIERAS COMUNES

1. Llamadas o WhatsApp ofreciendo crédito "preaprobado" de un banco. Señales de alerta:
   - Nombre del "banco" no aparece en la lista CMF
   - Piden depósito previo o "comisión de gestión"
   - Solicitan datos sensibles por mensaje (RUT, contraseñas, claves dinámicas)
   - Apuran la decisión "es solo por hoy"

2. Inversiones de "alta rentabilidad garantizada".
   - Por ley, NO se puede garantizar rentabilidad de instrumentos de mercado
   - Si te prometen 10% mensual o "100% seguro" → es estafa
   - Verifica si el oferente está en la lista de Asesores Financieros / Corredores supervisados

3. Phishing por SMS o email haciéndose pasar por banco.
   - Bancos NUNCA piden datos por SMS
   - Verifica el dominio del email cuidadosamente
   - Llama a la sucursal directo desde el reverso de tu tarjeta

4. "Préstamo gota a gota" / Crédito informal con cobranza ilegal.
   - Tasas que superan la TMC → contrato es ilegal
   - Cobranza con amenazas o acoso → denuncia a Carabineros + SERNAC

QUÉ HACER ANTE UNA ESTAFA SUFRIDA:
- Denuncia a Carabineros / PDI (constancia)
- Reclama a tu banco para revertir cargos (si transferiste)
- Reporta a CMF (denuncia, no reclamo): https://www.cmfchile.cl/portal/principal/613/w3-channel.html
- Comparte el caso en redes para alertar a otros
`
  }
];

const TARGET_TOKENS = 512;
const OVERLAP = 50;

function approxTokenCount(s: string): number {
  return Math.ceil(s.length / 4);
}

function chunkText(text: string, target: number = TARGET_TOKENS, overlap: number = OVERLAP): string[] {
  const paras = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (approxTokenCount(cur + '\n\n' + p) > target && cur) {
      chunks.push(cur.trim());
      const tail = cur.split(/\s+/).slice(-overlap).join(' ');
      cur = tail + '\n\n' + p;
    } else {
      cur = cur ? cur + '\n\n' + p : p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => approxTokenCount(c) >= 50);
}

async function fetchPdfText(url: string): Promise<string> {
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 });
  const data = await pdf(Buffer.from(res.data));
  return data.text;
}

async function ingestDoc(doc: SeedDoc): Promise<void> {
  const sb = supabase();
  let raw_text: string;
  if (doc.inline_text) {
    raw_text = doc.inline_text.trim();
  } else if (doc.pdf_url) {
    raw_text = await fetchPdfText(doc.pdf_url);
  } else {
    throw new Error(`doc ${doc.title} has neither inline_text nor pdf_url`);
  }

  const { data: reg, error: regErr } = await sb
    .from('regulations')
    .upsert(
      {
        source_url: doc.source_url,
        title: doc.title,
        document_type: doc.document_type,
        effective_date: doc.effective_date ?? null,
        raw_text,
        last_indexed_at: new Date().toISOString()
      },
      { onConflict: 'source_url' }
    )
    .select('id')
    .single();
  if (regErr || !reg) throw new Error(`upsert regulation failed: ${regErr?.message}`);

  const chunks = chunkText(raw_text);
  logger.info({ doc: doc.title, chunks: chunks.length }, 'embedding chunks');

  // Borra embeddings previos
  await sb.from('embeddings').delete().eq('regulation_id', reg.id);

  // Embed en batches de 50
  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(slice);
    const rows = slice.map((c, j) => ({
      regulation_id: reg.id,
      chunk_index: i + j,
      chunk_text: c,
      embedding: vectors[j],
      metadata: { document_type: doc.document_type }
    }));
    const { error } = await sb.from('embeddings').insert(rows);
    if (error) throw new Error(`embedding insert failed: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2] ?? 'seed';
  logger.info({ mode: arg }, 'starting CMF ingest');

  const docs = SEED;
  for (const d of docs) {
    try {
      await ingestDoc(d);
      logger.info({ doc: d.title }, 'ingested OK');
    } catch (e) {
      logger.error({ err: (e as Error).message, doc: d.title }, 'ingest failed');
    }
  }
  logger.info('CMF ingest complete');
  process.exit(0);
}

main().catch((e) => {
  logger.fatal({ err: e.message }, 'main failed');
  process.exit(1);
});
