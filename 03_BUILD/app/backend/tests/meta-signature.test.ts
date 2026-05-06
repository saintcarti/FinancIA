import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { verifyMetaSignature } from '../src/lib/meta';

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

function sign(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyMetaSignature', () => {
  const secret = 'test_secret_long_enough_for_validation';

  it('accepts valid signature', () => {
    const body = '{"object":"instagram"}';
    const sig = sign(body, secret);
    expect(verifyMetaSignature(Buffer.from(body), sig)).toBe(true);
  });

  it('rejects invalid signature', () => {
    const body = '{"object":"instagram"}';
    expect(verifyMetaSignature(Buffer.from(body), 'sha256=deadbeef')).toBe(false);
  });

  it('rejects missing prefix', () => {
    expect(verifyMetaSignature(Buffer.from('x'), 'deadbeef')).toBe(false);
  });

  it('rejects undefined header', () => {
    expect(verifyMetaSignature(Buffer.from('x'), undefined)).toBe(false);
  });

  it('uses timing-safe comparison', () => {
    const body = '{"a":1}';
    const valid = sign(body, secret);
    // Truncated should fail safely
    const trunc = valid.slice(0, valid.length - 1);
    expect(verifyMetaSignature(Buffer.from(body), trunc)).toBe(false);
  });
});
