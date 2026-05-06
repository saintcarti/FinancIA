import pino from 'pino';
import { config } from '../config.js';

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\d{1,2}\.\d{3}\.\d{3}-[\dkK]/g, '[RUT_REDACTED]'],
  [/\b\d{8,16}\b/g, '[ACCOUNT_REDACTED]'],
  [/[\w._%+-]+@[\w.-]+\.\w{2,}/g, '[EMAIL_REDACTED]'],
  [/\+?56\s?9\s?\d{4}\s?\d{4}/g, '[PHONE_REDACTED]']
];

export function redact(text: string): string {
  return PII_PATTERNS.reduce((t, [re, rep]) => t.replace(re, rep), text);
}

const cfg = config();

export const logger = pino({
  level: cfg.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    cfg.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  formatters: {
    log: (obj) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = typeof v === 'string' ? redact(v) : v;
      }
      return out;
    }
  }
});
