import { call, extractText } from '../lib/anthropic.js';
import { config } from '../config.js';

export async function summarizeConversation(
  previousSummary: string,
  newTurns: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const turnsText = newTurns
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n\n');

  const r = await call({
    model: config().HAIKU_MODEL as 'claude-haiku-4-5-20251001',
    purpose: 'summarizer',
    max_tokens: 250,
    temperature: 0,
    system:
      'Tu tarea: actualizar el resumen acumulado de una conversación entre un usuario y FinancIA Chile (asistente educativo financiero). ' +
      'El resumen debe capturar: (1) datos del usuario (no PII) — qué tipo de productos tiene, qué situación enfrenta; ' +
      '(2) temas ya cubiertos para no repetir; (3) compromisos pendientes (si el bot prometió algo). ' +
      'Devuelve solo el resumen actualizado en máximo 200 palabras, sin meta-comentarios.',
    messages: [
      {
        role: 'user',
        content: `RESUMEN PREVIO:\n${previousSummary || '(vacío)'}\n\nNUEVOS TURNOS:\n${turnsText}\n\nDevuelve el resumen actualizado:`
      }
    ]
  });

  return extractText(r.response).trim();
}
