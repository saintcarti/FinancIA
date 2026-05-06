import crypto from 'node:crypto';
import axios from 'axios';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Verifica firma HMAC SHA-256 del header X-Hub-Signature-256.
 * `body` es el raw Buffer del request (NO el JSON parseado).
 */
export function verifyMetaSignature(body: Buffer, signature: string | undefined): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const cfg = config();
  const expected = crypto.createHmac('sha256', cfg.META_APP_SECRET).update(body).digest('hex');
  const provided = signature.slice(7);
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/** Envía mensaje de texto via Instagram Messaging API */
export async function sendInstagramMessage(recipientId: string, text: string): Promise<void> {
  const cfg = config();
  await axios.post(
    `${GRAPH_BASE}/${cfg.IG_USER_ID}/messages`,
    {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE'
    },
    { params: { access_token: cfg.META_PAGE_ACCESS_TOKEN } }
  );
}

/** Envía mensaje de texto via WhatsApp Cloud API */
export async function sendWhatsAppMessage(toPhoneE164: string, text: string): Promise<void> {
  const cfg = config();
  await axios.post(
    `${GRAPH_BASE}/${cfg.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhoneE164,
      type: 'text',
      text: { body: text, preview_url: true }
    },
    { headers: { Authorization: `Bearer ${cfg.WHATSAPP_ACCESS_TOKEN}` } }
  );
}

/** Set typing indicator on Instagram (mejora UX) */
export async function setTypingOn(recipientId: string): Promise<void> {
  const cfg = config();
  try {
    await axios.post(
      `${GRAPH_BASE}/${cfg.IG_USER_ID}/messages`,
      { recipient: { id: recipientId }, sender_action: 'typing_on' },
      { params: { access_token: cfg.META_PAGE_ACCESS_TOKEN } }
    );
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'typing_on failed (non-critical)');
  }
}

/** Publica un Reel: dos pasos (create container, then publish) */
export async function publishInstagramReel(opts: {
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
}): Promise<{ media_id: string }> {
  const cfg = config();
  // Step 1: create media container
  const create = await axios.post(`${GRAPH_BASE}/${cfg.IG_USER_ID}/media`, null, {
    params: {
      media_type: 'REELS',
      video_url: opts.videoUrl,
      caption: opts.caption,
      share_to_feed: opts.shareToFeed ?? true,
      access_token: cfg.META_PAGE_ACCESS_TOKEN
    }
  });
  const containerId = create.data.id as string;

  // Step 2: poll until ready (max 5 min)
  const start = Date.now();
  while (Date.now() - start < 5 * 60_000) {
    const status = await axios.get(`${GRAPH_BASE}/${containerId}`, {
      params: { fields: 'status_code', access_token: cfg.META_PAGE_ACCESS_TOKEN }
    });
    if (status.data.status_code === 'FINISHED') break;
    if (status.data.status_code === 'ERROR') throw new Error('IG container error');
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Step 3: publish
  const pub = await axios.post(`${GRAPH_BASE}/${cfg.IG_USER_ID}/media_publish`, null, {
    params: { creation_id: containerId, access_token: cfg.META_PAGE_ACCESS_TOKEN }
  });
  return { media_id: pub.data.id as string };
}
