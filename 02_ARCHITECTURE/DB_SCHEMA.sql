-- Ver 03_BUILD/migrations/001_initial_schema.sql para la migración productiva versionada.
-- Este archivo es solo el snapshot conceptual del esquema.

-- Tablas principales (ver archivo de migración para detalle):
--   app_users          → usuarios IG/WhatsApp
--   conversations      → hilos de conversación
--   messages           → mensajes user/assistant/tool
--   processed_webhooks → idempotencia Meta retries
--   regulations        → corpus normativo CMF
--   embeddings         → vectores RAG (pgvector 768d)
--   videos             → Reels publicados
--   video_metrics      → engagement de Reels
--   cmf_cache          → indicadores CMF (UF, IPC, TPM)
--   claude_calls       → cost log por llamada
--   daily_metrics      → rollup diario
--   admin_emails       → allowlist admin dashboard
--   audit_log          → acciones admin

-- Funciones:
--   hybrid_search(embedding, text, k)
--   trigger_set_updated_at
--   trigger_update_conversation_on_message
--   trigger_update_user_seen

-- RLS: habilitada en tablas sensibles. Service role bypass (backend).
-- Admin dashboard lee con JWT cuyo email esté en admin_emails.
