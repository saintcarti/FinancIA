import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  Object.assign(process.env, {
    ZERNIO_API_KEY: 'zer_' + 'x'.repeat(20),
    ZERNIO_WEBHOOK_SECRET: 'whsec_' + 'a'.repeat(20),
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_key_long_enough',
    SUPABASE_ANON_KEY: 'anon_key_long_enough',
    ANTHROPIC_API_KEY: 'sk-ant-' + 'x'.repeat(40),
    GOOGLE_AI_STUDIO_API_KEY: 'AIza' + 'x'.repeat(20),
    INTERNAL_SECRET: 'a'.repeat(20)
  });
});

import type { ZernioMessageReceivedEvent } from '../src/lib/zernio';

describe('Zernio payload shape', () => {
  it('valid IG message.received payload parses', () => {
    const payload: ZernioMessageReceivedEvent = {
      id: 'evt_abc123',
      event: 'message.received',
      timestamp: '2026-05-06T12:00:00Z',
      message: {
        id: 'msg_xyz',
        text: '¿Qué es la UF?',
        sender: { id: 'usr_111', name: 'Camila' }
      },
      conversation: { id: 'conv_aaa' },
      account: { id: 'acc_ig', platform: 'instagram' }
    };
    expect(payload.account.platform).toBe('instagram');
    expect(payload.message.text).toBe('¿Qué es la UF?');
    expect(payload.conversation.id).toBe('conv_aaa');
  });

  it('valid WhatsApp payload', () => {
    const payload: ZernioMessageReceivedEvent = {
      id: 'evt_w1',
      event: 'message.received',
      timestamp: '2026-05-06T12:00:00Z',
      message: { id: 'msg_w1', text: 'Hola', sender: { id: '+56912345678' } },
      conversation: { id: 'conv_wa' },
      account: { id: 'acc_wa', platform: 'whatsapp' }
    };
    expect(payload.account.platform).toBe('whatsapp');
  });
});
