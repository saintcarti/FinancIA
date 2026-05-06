/**
 * FAQ pre-cached service.
 * Si la pregunta del usuario es semánticamente cercana a una FAQ pre-respondida
 * (similarity > 0.92), respondemos desde caché → latency ~200ms y costo ~0.
 *
 * Hit metric incrementa cada vez que matcheamos.
 */
import { supabase } from '../lib/supabase.js';
import { embedQuery } from '../lib/google-embeddings.js';
import { logger } from '../lib/logger.js';

const SIMILARITY_THRESHOLD = 0.92;

export interface FaqMatch {
  id: string;
  question: string;
  answer: string;
  citations: Array<{ title: string; url: string }>;
  similarity: number;
}

/**
 * Intenta encontrar una FAQ que matche al user message.
 * Devuelve null si no hay match suficientemente cercano.
 */
export async function lookupFaq(userQuery: string): Promise<FaqMatch | null> {
  try {
    const embedding = await embedQuery(userQuery);
    const { data, error } = await supabase().rpc('faq_lookup', {
      query_embedding: embedding,
      threshold: SIMILARITY_THRESHOLD
    });
    if (error) {
      logger.warn({ err: error.message }, 'faq_lookup rpc failed');
      return null;
    }
    const top = (data ?? [])[0] as FaqMatch | undefined;
    if (!top || top.similarity < SIMILARITY_THRESHOLD) return null;

    // Increment hit count async
    supabase()
      .from('faq_cache')
      .update({ hit_count: (await getCurrentHitCount(top.id)) + 1, updated_at: new Date().toISOString() })
      .eq('id', top.id)
      .then(() => {}, () => {});

    return top;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'faq lookup failed');
    return null;
  }
}

async function getCurrentHitCount(id: string): Promise<number> {
  const { data } = await supabase().from('faq_cache').select('hit_count').eq('id', id).single();
  return (data?.hit_count as number) ?? 0;
}

/** Inserta una FAQ pre-respondida con su embedding. */
export async function upsertFaq(opts: {
  question: string;
  answer: string;
  citations: Array<{ title: string; url: string }>;
}): Promise<void> {
  const normalized = opts.question.trim().toLowerCase();
  const embedding = await embedQuery(opts.question);
  await supabase()
    .from('faq_cache')
    .upsert(
      {
        question: opts.question,
        question_normalized: normalized,
        question_embedding: embedding,
        answer: opts.answer,
        citations: opts.citations,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'question_normalized' }
    );
}
