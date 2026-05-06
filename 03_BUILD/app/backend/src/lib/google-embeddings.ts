import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

let _client: GoogleGenerativeAI | null = null;
function client(): GoogleGenerativeAI {
  if (_client) return _client;
  _client = new GoogleGenerativeAI(config().GOOGLE_AI_STUDIO_API_KEY);
  return _client;
}

/** Embeds a single text query (768 dim with text-embedding-004) */
export async function embedQuery(text: string): Promise<number[]> {
  const model = client().getGenerativeModel({ model: config().EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/** Batch embed (up to 100 at a time) */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = client().getGenerativeModel({ model: config().EMBEDDING_MODEL });
  const result = await model.batchEmbedContents({
    requests: texts.map((t) => ({
      content: { role: 'user', parts: [{ text: t }] }
    }))
  });
  return result.embeddings.map((e) => e.values);
}
