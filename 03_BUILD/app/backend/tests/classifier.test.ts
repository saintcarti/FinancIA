import { describe, it, expect, vi, beforeAll } from 'vitest';

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
