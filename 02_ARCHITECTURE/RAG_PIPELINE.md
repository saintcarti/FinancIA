# RAG PIPELINE — FinancIA Chile

## Corpus

### Fuentes prioritarias
1. **Normativa CMF** — Compendio de Normas, Circulares vigentes (PDFs públicos)
2. **CMF Educa** — guías educativas oficiales del regulador
3. **Ley del Consumidor (Ley 19.496)** — texto refundido, módulo financiero
4. **Ley 20.715 (Tasa Máxima Convencional)**
5. **Reglamento DFL 251 (sector seguros)** — para preguntas de seguros
6. **Glosario CMF** — definiciones oficiales (UF, CAE, TPM, TIR, etc.)
7. **Indicadores en vivo** — UF, IPC, TPM, dólar, euro (no RAG, pero cache)

### Fuentes secundarias (mes 2)
8. **Resoluciones SERNAC** módulo financiero
9. **Sentencias Tribunal de Defensa de Libre Competencia** sector banca
10. **DFL 3 (Banco del Estado)**

### Excluido (con razón)
- ❌ Sitios de bancos comerciales (sesgo, contradicción regulatoria)
- ❌ Foros / Reddit (no autoridad)
- ❌ Material académico no oficial

## Pipeline de ingestión

```
PDF/HTML source
  ↓
Fetcher (axios + retry exponencial)
  ↓
Parser (pdf-parse para PDFs, cheerio para HTML)
  ↓
Cleaner (normalize whitespace, fix encoding, strip headers/footers repetidos)
  ↓
Chunker (RecursiveCharacterTextSplitter, 512 tokens, overlap 50)
  ↓
Metadata enricher (regulation_id, source_url, section, last_updated, document_type)
  ↓
Embedder (Google text-embedding-004, batches de 100)
  ↓
UPSERT Supabase (regulations + embeddings tables)
```

### Chunking strategy
- **Tamaño:** 512 tokens (≈ 350 palabras)
- **Overlap:** 50 tokens
- **Regla:** preservar headers de sección como prefijo del chunk para context grounding
- **Separadores prioridad:** `\n\n##` > `\n\n#` > `\n\n` > `\n` > `. ` > ` `
- **Mínimo:** descartar chunks < 50 tokens (suelen ser ruido)

### Re-ingest schedule
- **CMF normativa:** Lunes 03:00 CLT (semanal)
- **CMF Educa:** Mensual (rara vez cambia)
- **Indicadores:** No RAG, cache Redis 1h
- **Trigger manual:** endpoint admin `POST /api/regulations/reingest`

## Pipeline de retrieval (en cada conversación)

```
User query
  ↓
Query expansion (Haiku 100 tokens) — re-formula query con sinónimos: "cuanto cobra mi banco" → "comisiones bancarias mantención cuenta corriente"
  ↓
Hybrid search:
  ├─ Semantic search (pgvector cosine, top_k=8)
  └─ BM25 search (PG tsvector ts_rank, top_k=8)
  ↓
Merge + dedupe (chunk_id) → ~12-14 chunks únicos
  ↓
Re-rank (cross-encoder MiniLM-L6-v2 local, ONNX) → top 5 finales
  ↓
Inject en system prompt como `<context>...</context>`
```

### Threshold y fallback
- Si top_1 score < 0.65 → "low confidence" → bot dice "no encontré normativa específica, te oriento general"
- Si query es procedural ("cómo reclamo") → priorizar chunks con metadata `document_type=guide`

## Datos en vivo (no RAG, pero usados por el agente)

El agente puede llamar tools que internamente leen del cache CMF:
- `get_uf(date)` — UF del día
- `get_ipc(month)` — IPC del mes
- `get_tpm()` — Tasa de Política Monetaria vigente
- `get_dolar()` — tipo de cambio
- `verify_entity(name_or_rut)` — está supervisada?
- `get_max_rate(product, amount, term)` — tasa máxima convencional vigente

Estas no son RAG, son data calls. Pero el agente las orquesta como tools.

## Schema embeddings (Supabase)

```sql
CREATE TABLE regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT, -- 'circular' | 'norma' | 'guide' | 'law'
  jurisdiction TEXT DEFAULT 'CL',
  effective_date DATE,
  superseded BOOLEAN DEFAULT false,
  last_indexed_at TIMESTAMPTZ DEFAULT NOW(),
  raw_text TEXT
);

CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL, -- text-embedding-004 dim
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (regulation_id, chunk_index)
);

CREATE INDEX idx_embeddings_vec ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_embeddings_tsv ON embeddings USING GIN (tsv);
```

## SQL de búsqueda hybrid

```sql
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding VECTOR(768),
  query_text TEXT,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  regulation_id UUID,
  chunk_text TEXT,
  source_url TEXT,
  semantic_score FLOAT,
  bm25_score FLOAT,
  combined_score FLOAT
) LANGUAGE SQL AS $$
  WITH semantic AS (
    SELECT e.id, e.regulation_id, e.chunk_text, r.source_url,
           1 - (e.embedding <=> query_embedding) AS score
    FROM embeddings e
    JOIN regulations r ON r.id = e.regulation_id
    WHERE NOT r.superseded
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count
  ),
  bm25 AS (
    SELECT e.id, e.regulation_id, e.chunk_text, r.source_url,
           ts_rank_cd(e.tsv, plainto_tsquery('spanish', query_text)) AS score
    FROM embeddings e
    JOIN regulations r ON r.id = e.regulation_id
    WHERE NOT r.superseded
      AND e.tsv @@ plainto_tsquery('spanish', query_text)
    ORDER BY score DESC
    LIMIT match_count
  ),
  unioned AS (
    SELECT id, regulation_id, chunk_text, source_url,
           score AS semantic_score, 0.0 AS bm25_score
    FROM semantic
    UNION ALL
    SELECT id, regulation_id, chunk_text, source_url,
           0.0 AS semantic_score, score AS bm25_score
    FROM bm25
  )
  SELECT id, regulation_id, chunk_text, source_url,
         MAX(semantic_score) AS semantic_score,
         MAX(bm25_score) AS bm25_score,
         (MAX(semantic_score) * 0.6 + MAX(bm25_score) * 0.4) AS combined_score
  FROM unioned
  GROUP BY id, regulation_id, chunk_text, source_url
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;
```

## Quality assurance del RAG

### Eval set
50 preguntas reales (semilla) con respuesta esperada y chunk fuente. Re-ejecutar tras cada cambio de:
- Modelo de embedding
- Estrategia de chunking
- Pesos hybrid
- Cantidad de chunks recuperados

### Métricas
- **Recall@5:** ≥ 0.85 (chunk correcto está en top 5)
- **Precision@5:** ≥ 0.6
- **MRR:** ≥ 0.70
- **Citation accuracy:** 100% (la respuesta cita el chunk que realmente usó)
