import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.META_APP_SECRET = 'test_secret_long_enough_for_validation';
  process.env.META_VERIFY_TOKEN = 'verify123';
  process.env.META_PAGE_ACCESS_TOKEN = 'page_access_token_long_enough';
  process.env.IG_USER_ID = '12345';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '67890';
  process.env.WHATSAPP_ACCESS_TOKEN = 'wa_access_token_long_enough';
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key_long_enough';
  process.env.SUPABASE_ANON_KEY = 'anon_key_long_enough';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-' + 'x'.repeat(40);
  process.env.GOOGLE_AI_STUDIO_API_KEY = 'AIza' + 'x'.repeat(20);
  process.env.INTERNAL_SECRET = 'a'.repeat(20);
});

vi.mock('../src/lib/anthropic', () => ({
  call: vi.fn(),
  extractText: vi.fn(() => 'simple')
}));

import { classify } from '../src/agents/classifier';

describe('classifier heuristics', () => {
  it('short messages → simple (no API call)', async () => {
    expect(await classify('qué es la UF')).toBe('simple');
  });
  it('image attachment → complex', async () => {
    expect(await classify('te mando esta imagen del contrato para que la revises')).toBe('complex');
  });
  it('comparison phrasing → complex', async () => {
    expect(await classify('cuál me conviene mejor: el banco A o el banco B versus el C')).toBe('complex');
  });
  it('very long → complex', async () => {
    expect(await classify('a'.repeat(600))).toBe('complex');
  });
});
