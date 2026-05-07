-- ⚠️ DEPRECATED — usa migrations/all.sql (idempotente, consolidado, incluye RPCs y faq_cache).
-- Este archivo se mantiene por trazabilidad de la migration history inicial. NO lo apliques directamente.
-- Si estás haciendo setup limpio: corre `migrations/all.sql` en Supabase SQL Editor y listo.

-- FinancIA Chile — schema inicial (LEGACY)

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =========================================================
-- USERS (de Instagram/WhatsApp, no admins)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,            -- Meta user id
  channel TEXT NOT NULL CHECK (channel IN ('instagram','whatsapp')),
  display_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  human_in_loop_until TIMESTAMPTZ,
  UNIQUE (external_id, channel)
);
CREATE INDEX idx_app_users_last_seen ON public.app_users (last_seen_at DESC);

-- =========================================================
-- CONVERSATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
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
CREATE INDEX idx_conv_user ON public.conversations (user_id);
CREATE INDEX idx_conv_last_msg ON public.conversations (last_message_at DESC);
CREATE INDEX idx_conv_flagged ON public.conversations (flagged) WHERE flagged = TRUE;

-- =========================================================
-- MESSAGES
-- =========================================================
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
CREATE INDEX idx_messages_conv ON public.messages (conversation_id, created_at);
CREATE UNIQUE INDEX idx_messages_meta ON public.messages (meta_message_id) WHERE meta_message_id IS NOT NULL;

-- =========================================================
-- WEBHOOK IDEMPOTENCY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  meta_message_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
-- Cleanup automático (>30 días) via cron
CREATE INDEX idx_proc_webhooks_age ON public.processed_webhooks (processed_at);

-- =========================================================
-- REGULATIONS (corpus base CMF)
-- =========================================================
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
CREATE INDEX idx_reg_active ON public.regulations (superseded) WHERE superseded = FALSE;

-- =========================================================
-- EMBEDDINGS (RAG vector store)
-- =========================================================
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
CREATE INDEX idx_emb_vec ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_emb_tsv ON public.embeddings USING GIN (tsv);
CREATE INDEX idx_emb_reg ON public.embeddings (regulation_id);

-- =========================================================
-- VIDEOS (Reels generados)
-- =========================================================
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
CREATE INDEX idx_videos_published ON public.videos (published_at DESC NULLS LAST);

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
CREATE INDEX idx_vm_video ON public.video_metrics (video_id, measured_at DESC);

-- =========================================================
-- CMF CACHE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cmf_cache (
  cache_key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  ttl_seconds INT NOT NULL
);

-- =========================================================
-- CLAUDE CALLS (cost log)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.claude_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID,
  model TEXT NOT NULL,
  purpose TEXT,                 -- 'qa' | 'classifier' | 'video_script' | 'comment_reply' | 'summarizer'
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cache_read_tokens INT DEFAULT 0,
  cache_write_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL,
  latency_ms INT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_calls_conv ON public.claude_calls (conversation_id);
CREATE INDEX idx_calls_day ON public.claude_calls (created_at DESC);

-- =========================================================
-- DAILY METRICS (rollup)
-- =========================================================
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

-- =========================================================
-- AUDIT LOG (admin acciones)
-- =========================================================
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

-- =========================================================
-- RLS
-- =========================================================
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

-- Backend con service_role bypass RLS automáticamente
-- Admin dashboard usa anon key + JWT, lee solo si auth.uid() es admin
CREATE POLICY "admin_read_all_users" ON public.app_users
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN (SELECT email FROM admin_emails))
  );

-- Tabla de emails admin (managed via Supabase Studio)
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.admin_emails (email) VALUES ('b.calderan2008@gmail.com') ON CONFLICT DO NOTHING;

-- Replica policy para resto de tablas
CREATE POLICY "admin_read_conv" ON public.conversations FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);
CREATE POLICY "admin_read_messages" ON public.messages FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);
CREATE POLICY "public_read_reg" ON public.regulations FOR SELECT USING (true);
CREATE POLICY "public_read_emb" ON public.embeddings FOR SELECT USING (true);
CREATE POLICY "public_read_videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "admin_read_calls" ON public.claude_calls FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);
CREATE POLICY "admin_read_daily" ON public.daily_metrics FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (SELECT 1 FROM admin_emails WHERE email = auth.jwt() ->> 'email')
);

-- =========================================================
-- TRIGGERS
-- =========================================================

-- updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- last_message_at + message_count en conversations
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

CREATE TRIGGER messages_update_conv
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_update_conversation_on_message();

-- last_seen_at en app_users
CREATE OR REPLACE FUNCTION trigger_update_user_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.app_users
  SET last_seen_at = NOW()
  WHERE id = (SELECT user_id FROM public.conversations WHERE id = NEW.conversation_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_user
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_update_user_seen();

-- =========================================================
-- HYBRID SEARCH FUNCTION
-- =========================================================
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

-- =========================================================
-- CLEANUP CRON (Supabase pg_cron)
-- =========================================================
-- Habilitar pg_cron en Supabase Dashboard primero, luego:
-- SELECT cron.schedule('purge-old-webhooks', '0 3 * * *',
--   $$DELETE FROM processed_webhooks WHERE processed_at < NOW() - INTERVAL '30 days'$$);
-- SELECT cron.schedule('purge-old-messages', '0 4 1 * *',
--   $$UPDATE messages SET content = '[REDACTED]' WHERE created_at < NOW() - INTERVAL '90 days'$$);
