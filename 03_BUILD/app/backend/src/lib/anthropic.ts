import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from './logger.js';
import { supabase } from './supabase.js';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: config().ANTHROPIC_API_KEY });
  return _client;
}

// Pricing $/M tokens (Q2 2026)
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0, cache_read: 0.1, cache_write: 1.25 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cache_read: 0.3, cache_write: 3.75 },
  'claude-opus-4-7': { input: 15.0, output: 75.0, cache_read: 1.5, cache_write: 18.75 }
} as const;

export type ModelId = keyof typeof PRICING;

export interface CallOpts {
  model: ModelId;
  system: Anthropic.MessageCreateParams['system'];
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  max_tokens?: number;
  temperature?: number;
  purpose: 'qa' | 'classifier' | 'video_script' | 'comment_reply' | 'summarizer' | 'query_expansion';
  conversationId?: string;
  messageId?: string;
}

export interface CallResult {
  response: Anthropic.Message;
  cost_usd: number;
  latency_ms: number;
  call_id: string;
}

function calcCost(model: ModelId, usage: Anthropic.Usage): number {
  const p = PRICING[model];
  const inp = ((usage.input_tokens ?? 0) * p.input) / 1_000_000;
  const out = ((usage.output_tokens ?? 0) * p.output) / 1_000_000;
  const cr = ((usage.cache_read_input_tokens ?? 0) * p.cache_read) / 1_000_000;
  const cw = ((usage.cache_creation_input_tokens ?? 0) * p.cache_write) / 1_000_000;
  return Number((inp + out + cr + cw).toFixed(6));
}

export async function call(opts: CallOpts): Promise<CallResult> {
  const t0 = Date.now();
  const response = await client().messages.create({
    model: opts.model,
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
    max_tokens: opts.max_tokens ?? 1024,
    temperature: opts.temperature ?? 0.3
  });
  const latency_ms = Date.now() - t0;
  const cost_usd = calcCost(opts.model, response.usage);

  const { data, error } = await supabase()
    .from('claude_calls')
    .insert({
      conversation_id: opts.conversationId ?? null,
      message_id: opts.messageId ?? null,
      model: opts.model,
      purpose: opts.purpose,
      input_tokens: response.usage.input_tokens ?? 0,
      output_tokens: response.usage.output_tokens ?? 0,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: response.usage.cache_creation_input_tokens ?? 0,
      cost_usd,
      latency_ms,
      tool_calls: response.content.filter((c) => c.type === 'tool_use')
    })
    .select('id')
    .single();

  if (error) logger.warn({ err: error.message }, 'failed to log claude call');

  return { response, cost_usd, latency_ms, call_id: data?.id ?? 'unknown' };
}

export function extractText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export function extractToolUses(msg: Anthropic.Message): Anthropic.ToolUseBlock[] {
  return msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
}
