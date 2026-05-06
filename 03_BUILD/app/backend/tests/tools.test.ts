import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  Object.assign(process.env, {
    META_APP_SECRET: 'test_secret_long_enough_for_validation',
    META_VERIFY_TOKEN: 'verify123',
    META_PAGE_ACCESS_TOKEN: 'page_access_token_long_enough',
    IG_USER_ID: '12345',
    WHATSAPP_PHONE_NUMBER_ID: '67890',
    WHATSAPP_ACCESS_TOKEN: 'wa_access_token_long_enough',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_key_long_enough',
    SUPABASE_ANON_KEY: 'anon_key_long_enough',
    ANTHROPIC_API_KEY: 'sk-ant-' + 'x'.repeat(40),
    GOOGLE_AI_STUDIO_API_KEY: 'AIza' + 'x'.repeat(20),
    INTERNAL_SECRET: 'a'.repeat(20)
  });
});

vi.mock('ioredis', () => ({
  default: class {
    get = vi.fn().mockResolvedValue(null);
    setex = vi.fn().mockResolvedValue('OK');
    on = vi.fn();
    multi = vi.fn(() => ({ incr: () => ({ expire: () => ({ exec: () => Promise.resolve([]) }) }) }));
    ping = vi.fn().mockResolvedValue('PONG');
    mget = vi.fn().mockResolvedValue([null, null]);
  }
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { UFs: [{ Valor: '38.502,12' }] } }),
    post: vi.fn().mockResolvedValue({ data: {} })
  }
}));

import { executeTool } from '../src/agents/tools';

describe('executeTool', () => {
  it('verify_entity returns supervised for known bank', async () => {
    const r = (await executeTool('verify_entity', { name_or_rut: 'Banco de Chile' })) as any;
    expect(r.supervised).toBe(true);
  });

  it('verify_entity returns false for unknown', async () => {
    const r = (await executeTool('verify_entity', { name_or_rut: 'Banco Pacífico Atlántico' })) as any;
    expect(r.supervised).toBe(false);
  });

  it('compare_rates flags rate above TMC', async () => {
    const r = (await executeTool('compare_rates', {
      product_type: 'consumo',
      amount_clp: 2_000_000,
      term_months: 24,
      offered_rate_annual_pct: 45
    })) as any;
    expect(r.exceeds_tmc).toBe(true);
  });

  it('compare_rates passes legal rate', async () => {
    const r = (await executeTool('compare_rates', {
      product_type: 'hipotecario',
      amount_clp: 80_000_000,
      term_months: 240,
      offered_rate_annual_pct: 6.2
    })) as any;
    expect(r.exceeds_tmc).toBe(false);
  });

  it('generate_complaint_guide returns 3 base steps', async () => {
    const r = (await executeTool('generate_complaint_guide', {
      institution: 'Banco X',
      issue_type: 'cobro_indebido',
      summary: 'Cobro de comisión no informada'
    })) as any;
    expect(r.pasos).toHaveLength(3);
  });

  it('rejects invalid input', async () => {
    const r = (await executeTool('verify_entity', { wrong_field: 'x' })) as any;
    expect(r.error).toBeDefined();
  });
});
