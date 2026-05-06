import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_ANON_KEY: z.string().min(20),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  HAIKU_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  SONNET_MODEL: z.string().default('claude-sonnet-4-6'),

  // Google AI (embeddings)
  GOOGLE_AI_STUDIO_API_KEY: z.string().min(20),
  EMBEDDING_MODEL: z.string().default('text-embedding-004'),

  // Meta — Instagram + WhatsApp
  META_APP_SECRET: z.string().min(20),
  META_VERIFY_TOKEN: z.string().min(8),
  META_PAGE_ACCESS_TOKEN: z.string().min(20),
  IG_USER_ID: z.string().min(5),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(5),
  WHATSAPP_ACCESS_TOKEN: z.string().min(20),

  // CMF
  CMF_API_KEY: z.string().optional(),
  CMF_BASE_URL: z.string().url().default('https://api.cmfchile.cl/api-sbifv3/recursos_api'),

  // Internal
  INTERNAL_SECRET: z.string().min(16),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),

  // Limits
  RATE_LIMIT_PER_DAY: z.coerce.number().default(20),
  RATE_LIMIT_PER_HOUR: z.coerce.number().default(5),

  // Public URLs
  PUBLIC_BASE_URL: z.string().url().default('https://api.financia-chile.cl')
});

export type Config = z.infer<typeof Schema>;

let _config: Config | null = null;
export function config(): Config {
  if (_config) return _config;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Config validation failed:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  _config = parsed.data;
  return _config;
}
