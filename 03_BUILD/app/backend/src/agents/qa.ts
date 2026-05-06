import type Anthropic from '@anthropic-ai/sdk';
import { call, extractText, extractToolUses, type ModelId } from '../lib/anthropic.js';
import { TOOLS, executeTool } from './tools.js';
import { prompt } from './prompts.js';
import { classify } from './classifier.js';
import { retrieve, formatContext, maxScore } from '../services/rag.js';
import { applyDisclaimer, passesGuardrails } from './guardrails.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export interface RunOpts {
  conversationId: string;
  userMessage: string;
  conversationSummary?: string;
  recentHistory?: Anthropic.MessageParam[]; // últimos turnos sin resumir
}

export interface RunResult {
  text: string;
  cost_usd: number;
  model_used: ModelId;
  tool_calls_made: number;
  rag_top_score: number;
  iterations: number;
}

const MAX_ITERATIONS = 4;

export async function runQA(opts: RunOpts): Promise<RunResult> {
  const cfg = config();
  const complexity = await classify(opts.userMessage);
  const model: ModelId = (complexity === 'complex'
    ? cfg.SONNET_MODEL
    : cfg.HAIKU_MODEL) as ModelId;

  // RAG retrieval
  const chunks = await retrieve(opts.userMessage, 5);
  const topScore = maxScore(chunks);
  const ragContext = formatContext(chunks);

  // System: 4 segmentos cacheados + 1 dinámico (RAG)
  const system: Anthropic.MessageCreateParams['system'] = [
    {
      type: 'text',
      text: prompt('system_qa'),
      cache_control: { type: 'ephemeral' }
    },
    {
      type: 'text',
      text:
        '<conversation_summary>\n' +
        (opts.conversationSummary?.trim() || 'Primera interacción del usuario.') +
        '\n</conversation_summary>',
      cache_control: { type: 'ephemeral' }
    },
    {
      type: 'text',
      text: ragContext
    },
    {
      type: 'text',
      text:
        topScore < 0.65
          ? '<retrieval_confidence>low</retrieval_confidence>\n' +
            'NOTA: el corpus normativo no tiene match fuerte para esta consulta. ' +
            'Indícale al usuario que orientas en general y dale fuente para verificar.'
          : '<retrieval_confidence>high</retrieval_confidence>'
    }
  ];

  const messages: Anthropic.MessageParam[] = [
    ...(opts.recentHistory ?? []),
    { role: 'user', content: opts.userMessage }
  ];

  let totalCost = 0;
  let iterations = 0;
  let toolCallsMade = 0;
  let finalText = '';

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const r = await call({
      model,
      purpose: 'qa',
      conversationId: opts.conversationId,
      max_tokens: complexity === 'complex' ? 1500 : 700,
      temperature: 0.3,
      system,
      tools: TOOLS,
      messages
    });
    totalCost += r.cost_usd;

    if (r.response.stop_reason === 'tool_use') {
      const toolUses = extractToolUses(r.response);
      toolCallsMade += toolUses.length;
      messages.push({ role: 'assistant', content: r.response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await executeTool(tu.name, tu.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result)
        });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    finalText = extractText(r.response);
    break;
  }

  // Guardrails
  const gr = passesGuardrails(finalText);
  if (!gr.ok) {
    logger.warn({ reason: gr.reason }, 'guardrail blocked output, reformulating');
    finalText =
      'Eso suena a recomendación personalizada y no puedo dártela — necesitarías un asesor financiero certificado. ' +
      'Lo que sí puedo: explicarte cómo funciona el instrumento o derecho que mencionas, sus riesgos y dónde verificarlo. ' +
      '¿Te oriento por ahí?';
  }

  // Fallback si quedó vacío
  if (!finalText.trim()) {
    finalText =
      'Disculpa, no pude generar una respuesta clara para tu consulta. ' +
      'Puedes reformularla o consultar directamente en CMF Educa: https://www.cmfchile.cl/educa/621/w3-channel.html';
  }

  return {
    text: applyDisclaimer(finalText),
    cost_usd: Number(totalCost.toFixed(6)),
    model_used: model,
    tool_calls_made: toolCallsMade,
    rag_top_score: topScore,
    iterations
  };
}
