import crypto from 'node:crypto';
import axios from 'axios';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Zernio = API unificada para Instagram + WhatsApp + otros canales.
 * Reemplaza la integración directa con Meta Graph API.
 *
 * Auth: Authorization: Bearer ZERNIO_API_KEY
 * Webhook signature: X-Zernio-Signature (HMAC SHA-256 hex lowercase del raw body)
 */

export type ZernioPlatform = 'instagram' | 'whatsapp' | 'tiktok' | 'linkedin' | 'x' | 'youtube';

export interface ZernioMessage {
  id: string;
  text?: string;
  attachments?: Array<{ type: string; url?: string }>;
}

export interface ZernioConversation {
  id: string;
  metadata?: Record<string, unknown>;
}

export interface ZernioAccount {
  id: string;
  platform: ZernioPlatform;
  name?: string;
}

export interface ZernioMessageReceivedEvent {
  id: string;
  event: 'message.received';
  message: ZernioMessage & { sender?: { id: string; name?: string } };
  conversation: ZernioConversation;
  account: ZernioAccount;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Verifica firma HMAC SHA-256 del header X-Zernio-Signature (lowercase hex del raw body).
 * `body` debe ser el Buffer raw, NO el JSON parseado.
 */
export function verifyZernioSignature(body: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expected = crypto
    .createHmac('sha256', config().ZERNIO_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

function client() {
  const cfg = config();
  return axios.create({
    baseURL: cfg.ZERNIO_BASE_URL,
    headers: {
      Authorization: `Bearer ${cfg.ZERNIO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 15_000
  });
}

/**
 * Responde a una conversación existente. Funciona para Instagram DM, WhatsApp,
 * o cualquier otro canal que el usuario haya conectado en Zernio.
 *
 * Para WhatsApp: si la última actividad del usuario fue hace > 24h, se requiere template.
 * Esta función intenta reply directo; si falla por la regla de 24h, el caller debe
 * manejar el fallback a template (no implementado en Q1).
 */
export async function replyToConversation(conversationId: string, text: string): Promise<void> {
  try {
    await client().post(`/v1/inbox/conversations/${conversationId}/messages`, {
      message: text
    });
  } catch (e) {
    const err = e as { response?: { data?: unknown; status?: number }; message: string };
    logger.error(
      { err: err.message, status: err.response?.status, data: err.response?.data, conversationId },
      'zernio reply failed'
    );
    throw e;
  }
}

/**
 * Indica al usuario que estamos "escribiendo" (typing indicator).
 * No documentado en Zernio; intentamos best-effort. Si falla, no bloqueamos.
 */
export async function setTyping(conversationId: string): Promise<void> {
  try {
    await client().post(`/v1/inbox/conversations/${conversationId}/typing`, { state: 'on' });
  } catch (e) {
    logger.debug({ err: (e as Error).message }, 'typing indicator not supported (non-critical)');
  }
}

/**
 * Publica un Reel de Instagram via Zernio.
 * NOTA: la documentación pública de Zernio no detalla este endpoint todavía.
 * Endpoint estimado según el patrón de otros recursos. Revisar en deploy real.
 */
export async function publishInstagramReel(opts: {
  accountId: string;
  videoUrl: string;
  caption: string;
}): Promise<{ media_id: string }> {
  try {
    const res = await client().post('/v1/instagram/reels', {
      accountId: opts.accountId,
      videoUrl: opts.videoUrl,
      caption: opts.caption
    });
    return { media_id: (res.data as { id: string }).id };
  } catch (e) {
    const err = e as { response?: { data?: unknown; status?: number }; message: string };
    logger.error(
      { err: err.message, status: err.response?.status, data: err.response?.data },
      'zernio publish reel failed — verifica endpoint con docs.zernio.com'
    );
    throw e;
  }
}
