import { call, extractText } from '../lib/anthropic.js';
import { prompt } from './prompts.js';
import { config } from '../config.js';

export type Complexity = 'simple' | 'complex';

export async function classify(userMessage: string): Promise<Complexity> {
  // Heurísticas baratas primero
  if (userMessage.length < 50) return 'simple';
  if (/\b(imagen|foto|adjunt|este contrato|esta cartola)\b/i.test(userMessage)) return 'complex';
  if (/(\bvs\b|\bversus\b|comparar|cuál.+(mejor|conviene)|comparemos)/i.test(userMessage)) return 'complex';
  if (userMessage.length > 500) return 'complex';

  const r = await call({
    model: config().HAIKU_MODEL as 'claude-haiku-4-5-20251001',
    purpose: 'classifier',
    max_tokens: 5,
    temperature: 0,
    system: prompt('system_classifier'),
    messages: [{ role: 'user', content: userMessage }]
  });
  const text = extractText(r.response).trim().toLowerCase();
  return text.includes('complex') ? 'complex' : 'simple';
}
