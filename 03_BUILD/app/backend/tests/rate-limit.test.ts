import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  Object.assign(process.env, {
    ZERNIO_API_KEY: 'zer_' + 'x'.repeat(20),
    ZERNIO_WEBHOOK_SECRET: 'whsec_' + 'a'.repeat(20),
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_key_long_enough',
    SUPABASE_ANON_KEY: 'anon_key_long_enough',
    ANTHROPIC_API_KEY: 'sk-ant-' + 'x'.repeat(40),
    GOOGLE_AI_STUDIO_API_KEY: 'AIza' + 'x'.repeat(20),
    INTERNAL_SECRET: 'a'.repeat(20),
    RATE_LIMIT_PER_DAY: '5',
    RATE_LIMIT_PER_HOUR: '3'
  });
});

const fakeStore: Record<string, number> = {};

vi.mock('ioredis', () => ({
  default: class {
    on = vi.fn();
    ping = vi.fn().mockResolvedValue('PONG');
    mget = vi.fn(async (...keys: string[]) => keys.map((k) => (fakeStore[k] ?? null)));
    multi() {
      const ops: Array<() => void> = [];
      const tx = {
        incr: (k: string) => {
          ops.push(() => { fakeStore[k] = (fakeStore[k] ?? 0) + 1; });
          return tx;
        },
        expire: (_k: string, _s: number) => tx,
        exec: async () => { ops.forEach((f) => f()); return [] as Array<unknown>; }
      };
      return tx;
    }
  }
}));

import { checkRateLimit } from '../src/services/rate-limit';

beforeEach(() => {
  for (const k of Object.keys(fakeStore)) delete fakeStore[k];
});

describe('rate limit sliding window', () => {
  it('allows up to RATE_LIMIT_PER_HOUR within an hour', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit('user1');
      expect(r.ok).toBe(true);
    }
    const r4 = await checkRateLimit('user1');
    expect(r4.ok).toBe(false);
  });

  it('returns reset_at when blocked', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit('user2');
    const r = await checkRateLimit('user2');
    expect(r.ok).toBe(false);
    expect(r.reset_at).toBeGreaterThan(Date.now());
  });

  it('isolates users (one user does not affect another)', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit('userA');
    const blocked = await checkRateLimit('userA');
    expect(blocked.ok).toBe(false);

    const fresh = await checkRateLimit('userB');
    expect(fresh.ok).toBe(true);
  });

  it('exposes remaining counts', async () => {
    const r = await checkRateLimit('user3');
    expect(r.ok).toBe(true);
    expect(r.remaining_hour).toBeGreaterThanOrEqual(0);
    expect(r.remaining_day).toBeGreaterThanOrEqual(0);
  });
});
