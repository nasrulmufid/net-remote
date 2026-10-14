import { z } from 'zod';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  try { process.loadEnvFile('.env'); } catch { /* ignore */ }
}

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
  DB_PATH: z.string().default('./data/netremote.db'),
  ADMIN_USERNAME: z.string().min(3).default('admin'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be >= 8 chars'),
  SESSION_COOKIE_SECURE: bool.default('false'),
  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PROXY_MAX_BODY_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  TRUST_PROXY: bool.default('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

/** Validated application configuration. */
export const config = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
});
