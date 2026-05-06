-- ===========================================================================
-- FinancIA Chile — schema consolidado idempotente.
-- Ejecutar en Supabase Studio → SQL Editor → run.
-- Combina migrations 001 + 002 + bootstrap admin emails.
-- Re-ejecutable: usa CREATE IF NOT EXISTS y ON CONFLICT.
-- ===========================================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===========================================================================
-- TABLES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('instagram','whatsapp')),
  display_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  human_in_loop_until TIMESTAMPTZ,
  UNIQUE (external_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_app_users_last_seen ON public.app_users (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  provider_conversation_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INT DEFAULT 0,
  satisfaction TEXT CHECK (satisfaction IN ('thumbs_up','thumbs_down','none')) DEFAULT 'none',
  topics TEXT[] DEFAULT '{}',
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  summary TEXT,
  summary_updated_at TIMESTAMPTZ
);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS provider_conversation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_conv_user ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON public.conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_flagged ON public.conversations (flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_conv_provider ON public.conversations (provider_conversation_id) WHERE provider_conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  meta_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claude_call_id UUID
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_meta ON public.messages (meta_message_id) WHERE meta_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  meta_message_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proc_webhooks_age ON public.processed_webhooks (processed_at);

CREATE TABLE IF NOT EXISTS public.regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  document_type TEXT,
  jurisdiction TEXT DEFAULT 'CL',
  effective_date DATE,
  superseded BOOLEAN DEFAULT FALSE,
  raw_text TEXT,
  last_indexed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reg_active ON public.regulations (superseded) WHERE superseded = FALSE;

CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID NOT NULL REFERENCES public.regulations(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (regulation_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_emb_vec ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_emb_tsv ON public.embeddings USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_emb_reg ON public.embeddings (regulation_id);

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT[],
  asset_url TEXT NOT NULL,
  ig_media_id TEXT,
  published_at TIMESTAMPTZ,
  topic TEXT,
  source_indicators JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_videos_published ON public.videos (published_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.video_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  saves INT DEFAULT 0,
  shares INT DEFAULT 0,
  dms_attributed INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vm_video ON public.video_metrics (video_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS public.cmf_cache (
  cache_key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  ttl_seconds INT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.claude_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID,
  model TEXT NOT NULL,
  purpose TEXT,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cache_read_tokens INT DEFAULT 0,
  cache_write_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL,
  latency_ms INT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calls_conv ON public.claude_calls (conversation_id);
CREATE INDEX IF NOT EXISTS idx_calls_day ON public.claude_calls (created_at DESC);

CREATE TABLE IF NOT EXISTS public.daily_metrics (
  date DATE PRIMARY KEY,
  conversations INT DEFAULT 0,
  useful_conversations INT DEFAULT 0,
  messages INT DEFAULT 0,
  thumbs_up INT DEFAULT 0,
  thumbs_down INT DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  tokens_input BIGINT DEFAULT 0,
  tokens_output BIGINT DEFAULT 0,
  reels_published INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.admin_emails (email) VALUES ('b.calderan2008@gmail.com') ON CONFLICT DO NOTHING;

-- Pre-cache de FAQ (top preguntas ya respondidas, para latency 200ms)
CREATE TABLE IF NOT EXISTS public.faq_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  question_normalized TEXT NOT NULL,
  question_embedding VECTOR(768),
  answer TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faq_emb ON public.faq_cache USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_faq_norm ON public.faq_cache USING GIN (to_tsvector('spanish', question_normalized));

-- Eval runs (resultados de la suite de evaluación)
CREATE TABLE IF NOT EXISTS public.eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  total_questions INT NOT NULL,
  passed INT NOT NULL,
  recall_at_5 NUMERIC(5,3),
  mrr NUMERIC(5,3),
  avg_latency_ms INT,
  avg_cost_usd NUMERIC(10,6),
  results JSONB
);

-- ===========================================================================
-- RLS
-- ===========================================================================
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_all_users" ON public.app_users;
CREATE POLICY "admin_read_all_users" ON public.app_users FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "admin_read_conv" ON public.conversations;
CREATE POLICY "admin_read_conv" ON public.conversations FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "admin_read_messages" ON public.messages;
CREATE POLICY "admin_read_messages" ON public.messages FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "public_read_reg" ON public.regulations;
CREATE POLICY "public_read_reg" ON public.regulations FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_emb" ON public.embeddings;
CREATE POLICY "public_read_emb" ON public.embeddings FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_videos" ON public.videos;
CREATE POLICY "public_read_videos" ON public.videos FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_read_calls" ON public.claude_calls;
CREATE POLICY "admin_read_calls" ON public.claude_calls FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "admin_read_daily" ON public.daily_metrics;
CREATE POLICY "admin_read_daily" ON public.daily_metrics FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "admin_read_evals" ON public.eval_runs;
CREATE POLICY "admin_read_evals" ON public.eval_runs FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

-- ===========================================================================
-- TRIGGERS
-- ===========================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      message_count = message_count + 1
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_update_conv ON public.messages;
CREATE TRIGGER messages_update_conv
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_update_conversation_on_message();

CREATE OR REPLACE FUNCTION trigger_update_user_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.app_users
  SET last_seen_at = NOW()
  WHERE id = (SELECT user_id FROM public.conversations WHERE id = NEW.conversation_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_update_user ON public.messages;
CREATE TRIGGER messages_update_user
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_update_user_seen();

-- ===========================================================================
-- RPCs
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_embedding VECTOR(768),
  query_text TEXT,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  regulation_id UUID,
  chunk_text TEXT,
  source_url TEXT,
  title TEXT,
  semantic_score FLOAT,
  bm25_score FLOAT,
  combined_score FLOAT
) LANGUAGE SQL STABLE AS $$
  WITH semantic AS (
    SELECT e.id, e.regulation_id, e.chunk_text, r.source_url, r.title,
           (1 - (e.embedding <=> query_embedding))::FLOAT AS score
    FROM public.embeddings e
    JOIN public.regulations r ON r.id = e.regulation_id
    WHERE NOT r.superseded
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count
  ),
  bm25 AS (
    SELECT e.id, e.regulation_id, e.chunk_text, r.source_url, r.title,
           ts_rank_cd(e.tsv, plainto_tsquery('spanish', query_text))::FLOAT AS score
    FROM public.embeddings e
    JOIN public.regulations r ON r.id = e.regulation_id
    WHERE NOT r.superseded
      AND e.tsv @@ plainto_tsquery('spanish', query_text)
    ORDER BY score DESC
    LIMIT match_count
  ),
  unioned AS (
    SELECT id, regulation_id, chunk_text, source_url, title,
           score AS s_score, 0::FLOAT AS b_score FROM semantic
    UNION ALL
    SELECT id, regulation_id, chunk_text, source_url, title,
           0::FLOAT AS s_score, score AS b_score FROM bm25
  )
  SELECT id, regulation_id, chunk_text, source_url, title,
         MAX(s_score) AS semantic_score,
         MAX(b_score) AS bm25_score,
         (MAX(s_score) * 0.6 + MAX(b_score) * 0.4) AS combined_score
  FROM unioned
  GROUP BY id, regulation_id, chunk_text, source_url, title
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;

-- FAQ cache lookup: similarity > 0.92 = match exacto
CREATE OR REPLACE FUNCTION public.faq_lookup(
  query_embedding VECTOR(768),
  threshold FLOAT DEFAULT 0.92
) RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  citations JSONB,
  similarity FLOAT
) LANGUAGE SQL STABLE AS $$
  SELECT id, question, answer, citations,
         (1 - (question_embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.faq_cache
  WHERE question_embedding IS NOT NULL
  ORDER BY question_embedding <=> query_embedding
  LIMIT 1;
$$;

-- Top topics últimos N días
CREATE OR REPLACE FUNCTION public.get_top_topics(days_back INT DEFAULT 30, top_n INT DEFAULT 10)
RETURNS TABLE (topic TEXT, count BIGINT, satisfaction_rate NUMERIC)
LANGUAGE SQL STABLE AS $$
  SELECT
    unnest(topics) AS topic,
    COUNT(*)::BIGINT AS count,
    ROUND(AVG(CASE WHEN satisfaction = 'thumbs_up' THEN 1 WHEN satisfaction = 'thumbs_down' THEN 0 ELSE NULL END)::NUMERIC, 3) AS satisfaction_rate
  FROM public.conversations
  WHERE last_message_at > NOW() - (days_back || ' days')::INTERVAL
  GROUP BY topic
  ORDER BY count DESC
  LIMIT top_n;
$$;

-- Cost summary
CREATE OR REPLACE FUNCTION public.get_cost_summary(days_back INT DEFAULT 7)
RETURNS TABLE (date DATE, model TEXT, calls BIGINT, total_cost NUMERIC, avg_latency_ms NUMERIC)
LANGUAGE SQL STABLE AS $$
  SELECT
    date_trunc('day', created_at)::DATE AS date,
    model,
    COUNT(*)::BIGINT AS calls,
    SUM(cost_usd)::NUMERIC AS total_cost,
    ROUND(AVG(latency_ms)::NUMERIC, 0) AS avg_latency_ms
  FROM public.claude_calls
  WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
  GROUP BY date, model
  ORDER BY date DESC, model;
$$;

-- ===========================================================================
-- DONE
-- ===========================================================================
SELECT 'FinancIA Chile schema applied OK' AS status,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS public_tables;
