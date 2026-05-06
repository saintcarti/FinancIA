-- Migración Zernio: el reply requiere el conversationId del provider (Zernio)
-- ya que no contactamos al user directo, sino al hilo conversacional.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS provider_conversation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conv_provider
  ON public.conversations (provider_conversation_id)
  WHERE provider_conversation_id IS NOT NULL;
