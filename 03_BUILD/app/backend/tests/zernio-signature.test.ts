import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';

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

import { verifyZernioSignature } from '../src/lib/zernio';

const SECRET = 'whsec_' + 'a'.repeat(20);

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

describe('verifyZernioSignature', () => {
  it('accepts valid signature (raw hex, no prefix)', () => {
    const body = '{"id":"e1","event":"message.received"}';
    expect(verifyZernioSignature(Buffer.from(body), sign(body))).toBe(true);
  });

  it('accepts valid signature with sha256= prefix', () => {
    const body = '{"id":"e1"}';
    expect(verifyZernioSignature(Buffer.from(body), 'sha256=' + sign(body))).toBe(true);
  });

  it('rejects mismatched signature', () => {
    expect(verifyZernioSignature(Buffer.from('{"a":1}'), 'deadbeef')).toBe(false);
  });

  it('rejects undefined header', () => {
    expect(verifyZernioSignature(Buffer.from('x'), undefined)).toBe(false);
  });

  it('uses timing-safe comparison (truncated → false)', () => {
    const body = '{"id":"e1"}';
    const valid = sign(body);
    expect(verifyZernioSignature(Buffer.from(body), valid.slice(0, valid.length - 2))).toBe(false);
  });

  it('rejects body tampered after signing', () => {
    const original = '{"id":"e1"}';
    const tampered = '{"id":"e2"}';
    const sig = sign(original);
    expect(verifyZernioSignature(Buffer.from(tampered), sig)).toBe(false);
  });
});
