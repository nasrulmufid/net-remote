import { safeEqual } from '../utils/crypto.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Double-submit cookie CSRF check (onRequest hook factory).
 * Skipped for /auth/* (SameSite=strict cookies + login form token) and /remote/* (device forms can't send our header;
 * protected by SameSite=strict auth cookie).
 */
export function csrfHook(req, reply, done) {
  if (!UNSAFE.has(req.method) || req.url.startsWith('/auth/') || req.url.startsWith('/remote/')) return done();
  const cookie = req.cookies?.csrf_token;
  const header = req.headers['x-csrf-token'];
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return reply.code(403).send({ error: { code: 'CSRF', message: 'Invalid or missing CSRF token' } });
  }
  return done();
}
