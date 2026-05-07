import { supabase } from '../lib/supabase.js';
import { embedQuery } from '../lib/google-embeddings.js';
import { logger } from '../lib/logger.js';

export interface RetrievedChunk {
  id: string;
  regulation_id: string;
  chunk_text: string;
  source_url: string;
  title: string;
  semantic_score: number;
  bm25_score: number;
  combined_score: number;
}

/**
 * Hybrid retrieval (semantic + BM25 fused) llamando función SQL `hybrid_search`.
 */
export async function retrieve(query: string, k: number = 5): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await supabase().rpc('hybrid_search', {
    query_embedding: embedding,
    query_text: query,
    match_count: k * 2 // sobre-recuperar luego filtrar por threshold
  });

  if (error) {
    logger.error({ err: error.message }, 'hybrid_search failed');
    return [];
  }

  const results = (data ?? []) as RetrievedChunk[];
  // Filtrar resultados muy débiles. Threshold 0.55 evita inyectar contexto irrelevante
  // que el modelo podría tomar como verdad. La señal `low_confidence` en qa.ts cubre 0.55-0.65.
  return results
    .filter((r) => r.combined_score > 0.55)
    .slice(0, k);
}

/**
 * Formatea chunks como bloque de contexto para inyectar al system prompt.
 */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '<context>\nNo se encontraron normativas específicas para esta consulta.\n</context>';
  }
  const items = chunks
    .map(
      (c, i) =>
        `[Fuente ${i + 1}] ${c.title}\nURL: ${c.source_url}\nExtracto:\n${c.chunk_text.trim()}`
    )
    .join('\n\n---\n\n');
  return `<context>\n${items}\n</context>`;
}

/**
 * Top score para decidir si la respuesta puede afirmar con confianza.
 */
export function maxScore(chunks: RetrievedChunk[]): number {
  return chunks.reduce((m, c) => Math.max(m, c.combined_score), 0);
}
