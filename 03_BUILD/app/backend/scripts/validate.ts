/**
 * VALIDATE — comprueba en cadena que TODO el sistema está operativo.
 *
 * Steps:
 *   1. Config carga sin errores
 *   2. Conexión Supabase + tablas existen
 *   3. Conexión Redis
 *   4. Anthropic alcanzable + Haiku responde
 *   5. Google embeddings devuelve 768d
 *   6. CMF API responde (UF live)
 *   7. RAG retrieval devuelve resultados
 *   8. Tools ejecutan: verify_entity, compare_rates
 *   9. Agente end-to-end responde a "¿Qué es la UF?"
 *  10. Guardrails bloquean recomendaciones
 *
 * Falla rápido (no continúa al siguiente paso si el actual falla).
 *
 * Uso: npm run validate
 */
import { config } from '../src/config.js';
import { supabase } from '../src/lib/supabase.js';
import { redis } from '../src/lib/redis.js';
import { call, extractText } from '../src/lib/anthropic.js';
import { embedQuery } from '../src/lib/google-embeddings.js';
import { getUF, verifyEntity } from '../src/lib/cmf.js';
import { retrieve } from '../src/services/rag.js';
import { executeTool } from '../src/agents/tools.js';
import { runQA } from '../src/agents/qa.js';
import { passesGuardrails } from '../src/agents/guardrails.js';

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️ ';

let passed = 0;
let failed = 0;
const errors: Array<{ step: string; err: string }> = [];

async function step(name: string, fn: () => Promise<void | string>): Promise<void> {
  process.stdout.write(`${name.padEnd(45)} `);
  const t0 = Date.now();
  try {
    const note = await fn();
    const ms = Date.now() - t0;
    console.log(`${PASS} (${ms}ms)${note ? ` ${note}` : ''}`);
    passed++;
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = (e as Error).message;
    console.log(`${FAIL} (${ms}ms) ${msg}`);
    errors.push({ step: name, err: msg });
    failed++;
  }
}

async function main(): Promise<void> {
  console.log('\n═══ FinancIA Chile — System Validation ═══\n');

  await step('1. Config loads', async () => {
    config(); // valida zod schema
  });

  await step('2. Supabase reachable', async () => {
    const { error } = await supabase().from('regulations').select('id', { head: true, count: 'exact' });
    if (error) throw new Error(error.message);
  });

  await step('   regulations indexed', async () => {
    const { count, error } = await supabase().from('regulations').select('*', { head: true, count: 'exact' });
    if (error) throw new Error(error.message);
    if ((count ?? 0) === 0) throw new Error('no regulations indexed — run npm run ingest:cmf');
    return `(${count} docs)`;
  });

  await step('   embeddings indexed', async () => {
    const { count, error } = await supabase().from('embeddings').select('*', { head: true, count: 'exact' });
    if (error) throw new Error(error.message);
    if ((count ?? 0) === 0) throw new Error('no embeddings — run npm run ingest:cmf');
    return `(${count} chunks)`;
  });

  await step('3. Redis reachable', async () => {
    const r = await redis().ping();
    if (r !== 'PONG') throw new Error(`unexpected ping response: ${r}`);
  });

  await step('4. Anthropic Haiku', async () => {
    const r = await call({
      model: config().HAIKU_MODEL as 'claude-haiku-4-5-20251001',
      purpose: 'classifier',
      max_tokens: 10,
      temperature: 0,
      system: 'Responde solo "OK".',
      messages: [{ role: 'user', content: 'ping' }]
    });
    const t = extractText(r.response);
    if (!t.toUpperCase().includes('OK')) throw new Error(`unexpected reply: ${t}`);
  });

  await step('5. Google embeddings (768d)', async () => {
    const v = await embedQuery('hola');
    if (v.length !== 768) throw new Error(`unexpected dim: ${v.length}`);
  });

  await step('6. CMF UF live', async () => {
    const uf = await getUF();
    if (typeof uf.value !== 'number' || uf.value < 30000 || uf.value > 100000) {
      throw new Error(`UF unrealistic: ${uf.value}`);
    }
    return `UF=${uf.value.toLocaleString('es-CL')}`;
  });

  await step('7. RAG retrieval', async () => {
    const chunks = await retrieve('qué es la UF', 5);
    if (chunks.length === 0) throw new Error('zero chunks retrieved — corpus vacío?');
    if (chunks[0].combined_score < 0.3) throw new Error(`top score low: ${chunks[0].combined_score}`);
    return `(top score ${chunks[0].combined_score.toFixed(2)})`;
  });

  await step('8a. Tool verify_entity', async () => {
    const r = (await executeTool('verify_entity', { name_or_rut: 'Banco de Chile' })) as { supervised: boolean };
    if (!r.supervised) throw new Error('Banco de Chile should be supervised');
  });

  await step('8b. Tool compare_rates', async () => {
    const r = (await executeTool('compare_rates', {
      product_type: 'consumo',
      amount_clp: 2_000_000,
      term_months: 24,
      offered_rate_annual_pct: 50
    })) as { exceeds_tmc: boolean };
    if (!r.exceeds_tmc) throw new Error('50% should exceed consumo TMC');
  });

  await step('8c. Tool generate_complaint_guide', async () => {
    const r = (await executeTool('generate_complaint_guide', {
      institution: 'Banco X',
      issue_type: 'cobro_indebido',
      summary: 'cobro no autorizado'
    })) as { pasos: unknown[] };
    if (!Array.isArray(r.pasos) || r.pasos.length !== 3) throw new Error('expected 3 pasos');
  });

  await step('9. Agent end-to-end (¿Qué es la UF?)', async () => {
    const r = await runQA({
      conversationId: '00000000-0000-0000-0000-000000000000',
      userMessage: '¿Qué es la UF?'
    });
    if (!r.text.toLowerCase().includes('uf')) throw new Error('reply does not mention UF');
    if (!r.text.includes('No constituye asesoría financiera')) throw new Error('disclaimer missing');
    return `(${r.cost_usd.toFixed(5)} USD, ${r.model_used.split('-')[1]})`;
  });

  await step('10. Guardrails block recommendations', async () => {
    const r = passesGuardrails('Te recomiendo invertir en este fondo.');
    if (r.ok) throw new Error('guardrail did not block recommendation');
  });

  console.log('\n══════════════════════════════════════');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const e of errors) console.log(`  ${FAIL} ${e.step}: ${e.err}`);
    console.log('\n👉 Revisa los pasos fallidos antes de seguir con deploy.\n');
    process.exit(1);
  }
  console.log(`${PASS} Sistema operativo. Listo para producción.\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error('\nValidation crashed:', (e as Error).message);
  process.exit(1);
});
