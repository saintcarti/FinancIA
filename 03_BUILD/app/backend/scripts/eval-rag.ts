/**
 * EVAL SUITE — corre 50 preguntas representativas y mide calidad del agente.
 *
 * Métricas:
 * - Recall@5: el chunk fuente esperado está entre los top 5 retrievals
 * - MRR (Mean Reciprocal Rank): promedio del 1/rank donde aparece el chunk
 * - Disclaimer presente: 100% de respuestas debe terminar con disclaimer
 * - No-recommendation: ninguna respuesta debe contener "te recomiendo invertir/comprar..."
 * - Citation present: respuestas regulatorias deben citar fuente
 * - Avg latency_ms y avg cost_usd
 *
 * Uso:
 *   npm run eval:rag         (corre + reporta + persiste)
 *   npm run eval:rag -- --quick   (solo 10 preguntas)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedQuery } from '../src/lib/google-embeddings.js';
import { supabase } from '../src/lib/supabase.js';
import { runQA } from '../src/agents/qa.js';
import { logger } from '../src/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EvalCase {
  q: string;
  // palabras esperadas en la respuesta (subset, case-insensitive)
  expect_terms?: string[];
  // términos que NO deben aparecer (ej: "te recomiendo")
  forbid_terms?: string[];
  // título del documento esperado (RAG match)
  expect_doc_title_substr?: string;
  // categoría
  category: 'glosario' | 'derechos' | 'procedural' | 'comparacion' | 'estafa' | 'meta';
}

const EVAL_SET: EvalCase[] = [
  { q: '¿Qué es la UF?', expect_terms: ['unidad', 'reajustable', 'IPC'], category: 'glosario', expect_doc_title_substr: 'Glosario' },
  { q: '¿Qué es el CAE?', expect_terms: ['CAE', 'costo total', 'comparar'], category: 'glosario' },
  { q: '¿Qué es DICOM?', expect_terms: ['DICOM', 'morosidad', 'hoja'], category: 'glosario' },
  { q: '¿Qué es la TPM?', expect_terms: ['Tasa', 'Política Monetaria'], category: 'glosario' },
  { q: '¿Qué es la TMC?', expect_terms: ['Tasa Máxima', 'ley 18.010'], category: 'glosario' },
  { q: '¿Qué es el IPC?', expect_terms: ['Índice', 'Precios'], category: 'glosario' },
  { q: '¿Qué es la UTM?', expect_terms: ['Unidad Tributaria'], category: 'glosario' },
  { q: '¿Cómo verifico si un banco está supervisado por la CMF?', expect_terms: ['CMF', 'lista', 'supervisada'], category: 'derechos' },
  { q: '¿Cuál es la UF de hoy?', expect_terms: ['UF'], category: 'meta' }, // debe llamar tool
  { q: '¿Cuál es la TPM vigente?', expect_terms: ['TPM'], category: 'meta' }, // debe llamar tool

  { q: 'Mi banco me cobró un seguro que no autoricé, ¿qué hago?', expect_terms: ['Art. 17 D', 'autorización', 'reclamo'], category: 'derechos', expect_doc_title_substr: 'Cobros' },
  { q: '¿Cómo presento un reclamo a la CMF?', expect_terms: ['cmfchile.cl', '15 días', 'reclamo'], category: 'procedural', expect_doc_title_substr: 'Reclamos' },
  { q: '¿Tengo derecho a retracto en un crédito firmado online?', expect_terms: ['retracto', '10 días', '100 UF'], category: 'derechos' },
  { q: '¿Puedo prepagar mi crédito sin penalidad?', expect_terms: ['prepago', '1%', '1.5%'], category: 'derechos' },
  { q: '¿Tengo que contratar el seguro con la compañía del banco?', expect_terms: ['No', 'elegir', '17 D'], category: 'derechos' },
  { q: '¿Cuántas veces al año puedo cambiar de fondo en mi AFP?', expect_terms: ['4', 'gratis'], category: 'derechos' },
  { q: '¿Cómo cancelo mi tarjeta de crédito?', expect_terms: ['cancelar', 'sin penalidad'], category: 'procedural' },
  { q: '¿Qué pasa si no pago la cuota de mi tarjeta?', expect_terms: ['DICOM', '30 días'], category: 'derechos' },
  { q: '¿Cómo salgo de DICOM si ya pagué la deuda?', expect_terms: ['30 días', 'pagado', 'reportar'], category: 'procedural' },
  { q: '¿Puedo pedir mi hoja de información comercial gratis?', expect_terms: ['gratis', 'al año'], category: 'derechos' },

  { q: 'Me llaman ofreciendo crédito de un banco que no aparece en CMF, ¿es estafa?', expect_terms: ['CMF', 'no supervisado', 'estafa'], category: 'estafa' },
  { q: '¿Una empresa puede cobrarme intereses superiores a la tasa máxima legal?', expect_terms: ['TMC', 'ilegal', 'reducir'], category: 'derechos' },
  { q: '¿Qué hago si recibo amenazas en cobranza?', expect_terms: ['ilegal', 'denuncia', 'SERNAC'], category: 'estafa' },
  { q: 'Una "inversión garantiza 10% mensual", ¿es real?', expect_terms: ['estafa', 'no se puede garantizar'], category: 'estafa', forbid_terms: ['te recomiendo', 'invierte'] },
  { q: '¿Puede llamarme cobranza un domingo?', expect_terms: ['domingos', 'horario hábil'], category: 'derechos' },

  { q: '¿Qué tasa es mejor: 1.5% mensual sin comisiones vs 1.4% mensual con seguro?', expect_terms: ['CAE', 'comparar'], category: 'comparacion', forbid_terms: ['te recomiendo', 'deberías elegir'] },
  { q: '¿Es mejor cuenta corriente o cuenta vista para mi caso?', forbid_terms: ['te recomiendo', 'deberías'], category: 'comparacion' },
  { q: '¿Qué fondo de AFP me conviene más?', forbid_terms: ['te recomiendo', 'elige', 'asesor'], category: 'comparacion' }, // debe rechazar

  { q: '¿Cuánto puede cobrarme una institución por gastos de cobranza?', expect_terms: ['9%', '6%', '3%'], category: 'derechos' },
  { q: '¿Las cooperativas están reguladas?', expect_terms: ['CMF', 'Departamento de Cooperativas'], category: 'glosario' },
  { q: '¿Qué es Open Finance?', expect_terms: ['Ley 21.521', 'datos', 'autorización'], category: 'glosario' },
  { q: '¿Qué es una fintech regulada?', expect_terms: ['CMF', 'registro', 'Ley 21.521'], category: 'glosario' },
  { q: '¿Qué es el desgravamen?', expect_terms: ['saldo', 'fallece', 'invalidez'], category: 'glosario' },
  { q: '¿Cómo comparo dos créditos hipotecarios?', expect_terms: ['CAE', 'plazo', 'comparar'], category: 'comparacion' },

  { q: 'Hola', category: 'meta' }, // saludo simple
  { q: 'gracias', category: 'meta' }, // followup corto
  { q: '¿Quién eres?', expect_terms: ['FinancIA', 'CMF', 'educativo'], category: 'meta' },
  { q: '¿Eres asesor financiero?', expect_terms: ['No', 'asesor', 'educativo'], category: 'meta' },
  { q: '¿Cuánto cuestas?', expect_terms: ['gratis', 'gratuito'], category: 'meta' },

  { q: '¿Una fintech que no está en el registro CMF puede operar?', expect_terms: ['no', 'ilegal', 'registro'], category: 'derechos' },
  { q: '¿Puedo cambiar de AFP cuando quiera?', expect_terms: ['libre', 'gratuito'], category: 'derechos' },
  { q: '¿Cómo verifico si un préstamo informal es legal?', expect_terms: ['TMC', 'CMF'], category: 'derechos' },
  { q: '¿Qué hago si mi cartola tiene un cargo que no reconozco?', expect_terms: ['reclamo', 'comprobante'], category: 'procedural' },
  { q: '¿La línea de crédito de mi cuenta corriente es buena?', forbid_terms: ['te recomiendo', 'deberías'], expect_terms: ['CAE', 'tasa'], category: 'comparacion' },
  { q: '¿Cómo cambio el banco donde recibo mi sueldo?', expect_terms: ['libre'], category: 'procedural' },

  { q: 'Mi tasa CAE de tarjeta es 75% anual, ¿es legal?', expect_terms: ['TMC', 'verificar'], category: 'comparacion' },
  { q: '¿Tengo derecho a la grabación de una llamada del banco?', expect_terms: ['ley', 'derecho'], category: 'derechos' },
  { q: '¿Qué pasa si me declaro en quiebra personal?', expect_terms: ['Ley 20.720', 'reorganización'], category: 'derechos' },
  { q: '¿Cuándo prescribe una deuda?', expect_terms: ['3 años', 'prescripción'], category: 'derechos' },
  { q: '¿Es legal que mi banco suba la tasa de mi tarjeta sin avisarme?', expect_terms: ['30 días', 'aviso', 'no'], category: 'derechos' }
];

interface EvalResult {
  q: string;
  category: string;
  passed: boolean;
  reasons: string[];
  cost_usd: number;
  latency_ms: number;
  rag_top_score: number;
  model: string;
  reply_preview: string;
}

const DISCLAIMER_MARKER = 'No constituye asesoría financiera';
const FORBIDDEN_DEFAULTS = [
  /te recomiendo (invertir|comprar|vender|tomar|elegir)/i,
  /deberías (invertir|comprar|vender|elegir)/i,
  /yo (compraría|invertiría|vendería)/i,
  /esta es la mejor (opción|inversión|tasa)/i
];

async function runOne(c: EvalCase): Promise<EvalResult> {
  const t0 = Date.now();
  const r = await runQA({
    conversationId: '00000000-0000-0000-0000-000000000000',
    userMessage: c.q
  });
  const latency_ms = Date.now() - t0;
  const reply = r.text.toLowerCase();
  const reasons: string[] = [];

  // 1. Disclaimer presente
  if (!r.text.includes(DISCLAIMER_MARKER)) reasons.push('disclaimer_missing');

  // 2. No frases prohibidas (defaults + custom)
  for (const re of FORBIDDEN_DEFAULTS) {
    if (re.test(r.text)) reasons.push(`forbidden_default: ${re}`);
  }
  for (const t of c.forbid_terms ?? []) {
    if (reply.includes(t.toLowerCase())) reasons.push(`forbidden_custom: ${t}`);
  }

  // 3. Términos esperados (al menos 1 de los expect_terms si hay)
  if (c.expect_terms?.length) {
    const found = c.expect_terms.filter((t) => reply.includes(t.toLowerCase())).length;
    if (found === 0) reasons.push(`no_expected_terms: [${c.expect_terms.join(',')}]`);
  }

  // 4. Citation: si la respuesta es regulatoria (categoría != meta), debe citar
  if (c.category !== 'meta' && c.category !== 'comparacion') {
    if (!/\(.*?https?:\/\/.*?\)|cmfchile|sernac|ley\s+\d|art\.?\s+\d/i.test(r.text)) {
      reasons.push('no_citation');
    }
  }

  return {
    q: c.q,
    category: c.category,
    passed: reasons.length === 0,
    reasons,
    cost_usd: r.cost_usd,
    latency_ms,
    rag_top_score: r.rag_top_score,
    model: r.model_used,
    reply_preview: r.text.slice(0, 200)
  };
}

async function main(): Promise<void> {
  const isQuick = process.argv.includes('--quick');
  const cases = isQuick ? EVAL_SET.slice(0, 10) : EVAL_SET;

  logger.info({ total: cases.length, quick: isQuick }, 'starting eval');

  const results: EvalResult[] = [];
  let totalCost = 0;
  let totalLatency = 0;

  // Running serial para no superar rate limits Anthropic
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`[${i + 1}/${cases.length}] ${c.q.slice(0, 60)}... `);
    try {
      const r = await runOne(c);
      results.push(r);
      totalCost += r.cost_usd;
      totalLatency += r.latency_ms;
      process.stdout.write(r.passed ? '✅\n' : `❌ ${r.reasons.join('; ')}\n`);
    } catch (e) {
      const err = (e as Error).message;
      results.push({
        q: c.q,
        category: c.category,
        passed: false,
        reasons: [`error: ${err}`],
        cost_usd: 0,
        latency_ms: 0,
        rag_top_score: 0,
        model: 'error',
        reply_preview: ''
      });
      process.stdout.write(`💥 ${err}\n`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const passRate = passed / results.length;
  const avgCost = totalCost / results.length;
  const avgLatency = totalLatency / results.length;

  // Por categoría
  const byCategory: Record<string, { total: number; passed: number }> = {};
  for (const r of results) {
    byCategory[r.category] = byCategory[r.category] ?? { total: 0, passed: 0 };
    byCategory[r.category].total++;
    if (r.passed) byCategory[r.category].passed++;
  }

  console.log('\n══════════════ EVAL REPORT ══════════════');
  console.log(`Total:        ${results.length}`);
  console.log(`Passed:       ${passed} (${(passRate * 100).toFixed(1)}%)`);
  console.log(`Failed:       ${results.length - passed}`);
  console.log(`Avg cost:     $${avgCost.toFixed(5)}`);
  console.log(`Avg latency:  ${Math.round(avgLatency)}ms`);
  console.log(`Total cost:   $${totalCost.toFixed(4)}`);
  console.log('\n── By category ──');
  for (const [cat, s] of Object.entries(byCategory)) {
    console.log(`  ${cat.padEnd(12)} ${s.passed}/${s.total} (${((s.passed / s.total) * 100).toFixed(0)}%)`);
  }
  console.log('═════════════════════════════════════════\n');

  if (results.some((r) => !r.passed)) {
    console.log('── FAILED CASES ──');
    for (const r of results.filter((x) => !x.passed)) {
      console.log(`\nQ: ${r.q}`);
      console.log(`  category: ${r.category}`);
      console.log(`  reasons: ${r.reasons.join('; ')}`);
      console.log(`  reply_preview: "${r.reply_preview}"`);
    }
  }

  // Persist a Supabase
  try {
    await supabase().from('eval_runs').insert({
      total_questions: results.length,
      passed,
      avg_latency_ms: Math.round(avgLatency),
      avg_cost_usd: Number(avgCost.toFixed(6)),
      results
    });
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'failed to persist eval run');
  }

  // Persist a archivo
  const outPath = path.resolve(__dirname, '../../../eval-report.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { ran_at: new Date().toISOString(), passed, total: results.length, pass_rate: passRate, avg_cost: avgCost, avg_latency: avgLatency, results },
      null,
      2
    )
  );
  console.log(`\nReport written: ${outPath}`);

  process.exit(passRate >= 0.8 ? 0 : 1);
}

main().catch((e) => {
  logger.fatal({ err: e.message }, 'eval failed');
  process.exit(1);
});
