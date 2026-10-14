import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');

/** AES-256-GCM encrypt (reserved for future device credentials). Output: base64(iv|tag|ciphertext). */
export function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

/** Inverse of {@link encrypt}. */
export function decrypt(payload) {
  const buf = Buffer.from(payload, 'base64');
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

export const sha256 = (v) => createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('hex');

/** Constant-time string compare. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
