import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  getUF, getIPC, getTPM, getDolar, getEuro, getUTM,
  verifyEntity, getMaxConventionalRate
} from '../lib/cmf.js';
import { logger } from '../lib/logger.js';

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_indicator',
    description:
      'Devuelve el valor actual de un indicador económico chileno: UF, IPC, TPM, dólar observado, euro o UTM. ' +
      'Úsala SIEMPRE que el usuario pregunte por el valor de uno de estos indicadores hoy o en una fecha específica. ' +
      'No inventes valores numéricos.',
    input_schema: {
      type: 'object',
      properties: {
        indicator: { type: 'string', enum: ['uf', 'ipc', 'tpm', 'dolar', 'euro', 'utm'] },
        date: { type: 'string', description: 'YYYY-MM-DD opcional; default hoy. Para IPC y UTM usar YYYY-MM.' }
      },
      required: ['indicator']
    }
  },
  {
    name: 'verify_entity',
    description:
      'Verifica si una institución financiera está supervisada por la CMF de Chile. ' +
      'Úsala cuando el usuario menciona el nombre de un banco, cooperativa, financiera, AFP, ' +
      'compañía de seguros, fondo, o cualquier entidad que ofrezca productos financieros. ' +
      'Especialmente útil ante posibles estafas (entidad que llama ofreciendo crédito).',
    input_schema: {
      type: 'object',
      properties: {
        name_or_rut: { type: 'string', description: 'Nombre comercial o RUT de la entidad' }
      },
      required: ['name_or_rut']
    }
  },
  {
    name: 'compare_rates',
    description:
      'Compara una tasa que el usuario describe contra la Tasa Máxima Convencional (TMC) vigente fijada por la CMF. ' +
      'Úsala cuando el usuario pregunta si una tasa es legal, si lo cobran de más, o si una oferta es razonable.',
    input_schema: {
      type: 'object',
      properties: {
        product_type: {
          type: 'string',
          enum: ['consumo', 'linea_credito', 'tarjeta_credito', 'automotriz', 'hipotecario']
        },
        amount_clp: { type: 'number' },
        term_months: { type: 'integer' },
        offered_rate_annual_pct: { type: 'number' }
      },
      required: ['product_type', 'amount_clp', 'term_months', 'offered_rate_annual_pct']
    }
  },
  {
    name: 'generate_complaint_guide',
    description:
      'Genera una guía paso a paso para que el usuario presente un reclamo formal ante la institución, ' +
      'CMF o SERNAC, según el tipo de problema reportado.',
    input_schema: {
      type: 'object',
      properties: {
        institution: { type: 'string' },
        issue_type: {
          type: 'string',
          enum: [
            'cobro_indebido',
            'seguro_no_autorizado',
            'datos_dicom',
            'publicidad_enganosa',
            'negativa_atencion',
            'otro'
          ]
        },
        summary: { type: 'string', description: 'Resumen del problema en 1-2 frases' }
      },
      required: ['institution', 'issue_type', 'summary']
    }
  }
];

const ZGetIndicator = z.object({
  indicator: z.enum(['uf', 'ipc', 'tpm', 'dolar', 'euro', 'utm']),
  date: z.string().optional()
});
const ZVerifyEntity = z.object({ name_or_rut: z.string().min(2) });
const ZCompareRates = z.object({
  product_type: z.enum(['consumo', 'linea_credito', 'tarjeta_credito', 'automotriz', 'hipotecario']),
  amount_clp: z.number().positive(),
  term_months: z.number().int().positive(),
  offered_rate_annual_pct: z.number()
});
const ZComplaintGuide = z.object({
  institution: z.string().min(2),
  issue_type: z.enum([
    'cobro_indebido',
    'seguro_no_autorizado',
    'datos_dicom',
    'publicidad_enganosa',
    'negativa_atencion',
    'otro'
  ]),
  summary: z.string().min(5)
});

export async function executeTool(name: string, input: unknown): Promise<unknown> {
  try {
    switch (name) {
      case 'get_indicator': {
        const args = ZGetIndicator.parse(input);
        switch (args.indicator) {
          case 'uf': return await getUF(args.date);
          case 'ipc': return await getIPC(args.date);
          case 'tpm': return await getTPM();
          case 'dolar': return await getDolar(args.date);
          case 'euro': return await getEuro(args.date);
          case 'utm': return await getUTM(args.date);
        }
      }
      case 'verify_entity': {
        const args = ZVerifyEntity.parse(input);
        return await verifyEntity(args.name_or_rut);
      }
      case 'compare_rates': {
        const args = ZCompareRates.parse(input);
        const tmc = await getMaxConventionalRate(args.product_type, args.amount_clp, args.term_months);
        const exceedsTmc = args.offered_rate_annual_pct > tmc.tmc_annual_pct;
        return {
          offered_rate: args.offered_rate_annual_pct,
          tmc: tmc.tmc_annual_pct,
          reference_period: tmc.reference_period,
          exceeds_tmc: exceedsTmc,
          assessment: exceedsTmc
            ? 'La tasa ofrecida supera la TMC vigente. Eso significa que excede el límite legal — el usuario debería revisar y eventualmente reclamar.'
            : 'La tasa ofrecida está dentro del rango legal según la TMC vigente. No significa que sea barata, pero sí legal.'
        };
      }
      case 'generate_complaint_guide': {
        const args = ZComplaintGuide.parse(input);
        return buildComplaintGuide(args);
      }
      default:
        return { error: `unknown_tool: ${name}` };
    }
  } catch (e) {
    logger.error({ err: (e as Error).message, tool: name }, 'tool execution failed');
    return { error: 'tool_execution_failed', detail: (e as Error).message };
  }
}

function buildComplaintGuide(args: z.infer<typeof ZComplaintGuide>): unknown {
  const baseSteps = [
    {
      paso: 1,
      titulo: 'Reclamo formal a la institución',
      detalle: `Envía reclamo escrito a ${args.institution} usando su canal oficial (sitio web → "Atención al Cliente" → "Reclamos formales"). Guarda número de ticket. Por ley tienen 10 días hábiles para responder (Ley 19.496).`
    },
    {
      paso: 2,
      titulo: 'Si no responden o respuesta insatisfactoria → CMF',
      detalle:
        'Presenta reclamo en https://www.cmfchile.cl/portal/principal/613/w3-channel.html → "Reclamos en línea". Necesitas: número de ticket institución, copia de respuesta o ausencia de ella, descripción del problema, copia de contratos si aplica. CMF tiene 15 días hábiles para gestionar.'
    },
    {
      paso: 3,
      titulo: 'En paralelo (recomendable) → SERNAC',
      detalle:
        'SERNAC también recibe reclamos financieros y puede mediar. Sitio: https://www.sernac.cl/portal/618/w3-propertyvalue-12434.html. Útil porque su mediación suele ser más rápida que la CMF para casos chicos.'
    }
  ];

  const issueSpecific: Record<string, string[]> = {
    cobro_indebido: [
      'Adjunta cartola con cargo marcado',
      'Adjunta autorización original (si tienes contrato firmado, debe constar; si no, ese es tu mejor argumento)'
    ],
    seguro_no_autorizado: [
      'Solicita el comprobante de aceptación expresa (firma digital, grabación, email)',
      'Si no existe: tienes derecho a reembolso completo desde el primer cobro'
    ],
    datos_dicom: [
      'Pide a la institución la "Hoja de información comercial" (gratis 1 vez al año)',
      'Si la deuda no es tuya o ya pagada: pide la corrección formal antes del reclamo CMF'
    ],
    publicidad_enganosa: [
      'Captura la publicidad (screenshot con fecha)',
      'Presenta también ante SERNAC: la publicidad engañosa es competencia directa de ellos'
    ],
    negativa_atencion: [
      'Pide constancia escrita de la negativa (si fue presencial)',
      'Si fue telefónica: solicita la grabación. Por ley deben entregártela.'
    ],
    otro: ['Documenta el incidente con fecha, hora y nombres de quienes participaron.']
  };

  return {
    institucion: args.institution,
    tipo: args.issue_type,
    resumen_caso: args.summary,
    pasos: baseSteps,
    documentos_recomendados: issueSpecific[args.issue_type] ?? [],
    plazo_total_estimado: '15 a 45 días hábiles',
    base_legal: ['Ley 19.496 — Derechos del Consumidor', 'Ley 21.521 — Fintech', 'Compendio CMF']
  };
}
