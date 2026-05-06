import { redis } from '../lib/redis.js';
import { config } from '../config.js';

export interface RateLimitResult {
  ok: boolean;
  remaining_day?: number;
  remaining_hour?: number;
  reset_at?: number;
}

export async function checkRateLimit(userExternalId: string): Promise<RateLimitResult> {
  const cfg = config();
  const r = redis();
  const dayKey = `rl:d:${userExternalId}`;
  const hourKey = `rl:h:${userExternalId}`;

  const [dayCountStr, hourCountStr] = await r.mget(dayKey, hourKey);
  const dayCount = Number(dayCountStr ?? 0);
  const hourCount = Number(hourCountStr ?? 0);

  if (dayCount >= cfg.RATE_LIMIT_PER_DAY) {
    return { ok: false, reset_at: Date.now() + 86_400_000 };
  }
  if (hourCount >= cfg.RATE_LIMIT_PER_HOUR) {
    return { ok: false, reset_at: Date.now() + 3_600_000 };
  }

  const tx = r.multi();
  tx.incr(dayKey).expire(dayKey, 86400);
  tx.incr(hourKey).expire(hourKey, 3600);
  await tx.exec();

  return {
    ok: true,
    remaining_day: cfg.RATE_LIMIT_PER_DAY - dayCount - 1,
    remaining_hour: cfg.RATE_LIMIT_PER_HOUR - hourCount - 1
  };
}
