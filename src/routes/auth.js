import { z } from 'zod';
import * as auth from '../services/auth.service.js';
import * as audit from '../services/audit.service.js';
import { safeNext, requireAuth } from '../middleware/auth.middleware.js';
import { safeEqual, randomToken } from '../utils/crypto.js';
import { config } from '../config.js';

const loginBody = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
  _csrf: z.string().optional(),
});

const isJson = (req) => (req.headers['content-type'] ?? '').includes('application/json') || (req.headers.accept ?? '') === 'application/json';

/** @param {import('fastify').FastifyInstance} app */
export default async function authRoutes(app) {
  // Login page (also seeds the csrf cookie used by the hidden form field).
  app.get('/login', async (req, reply) => {
    try { await req.jwtVerify({ onlyCookie: true }); return reply.redirect(safeNext(req.query.next)); } catch { /* not logged in */ }
    let csrf = req.cookies.csrf_token;
    if (!csrf) {
      csrf = randomToken(24);
      reply.setCookie('csrf_token', csrf, { httpOnly: false, secure: config.SESSION_COOKIE_SECURE, sameSite: 'strict', path: '/' });
    }
    return reply.view('pages/login.ejs', { csrf, next: safeNext(req.query.next), error: null, layout: false });
  });

  app.post('/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const json = isJson(req);
    const parsed = loginBody.safeParse(req.body ?? {});
    const fail = (code, message, status) => {
      if (json) return reply.code(status).send({ error: { code, message } });
      return reply.code(status).view('pages/login.ejs', { csrf: req.cookies.csrf_token ?? '', next: safeNext(parsed.data?.next), error: message, layout: false });
    };
    if (!parsed.success) return fail('VALIDATION', 'Username dan password wajib diisi', 400);

    const { username, password, next, _csrf } = parsed.data;
    if (!json && !(req.cookies.csrf_token && _csrf && safeEqual(req.cookies.csrf_token, _csrf))) {
      return fail('CSRF', 'Sesi form kedaluwarsa, muat ulang halaman lalu coba lagi', 403);
    }

    const user = await auth.verifyCredentials(username, password);
    if (!user) {
      audit.logRequest(req, 'login_failed', { userId: null, metadata: { username } });
      return fail('INVALID_CREDENTIALS', 'Username atau password salah', 401);
    }
    const refresh = auth.createRefreshToken(user.id);
    auth.setSessionCookies(app, reply, user, refresh);
    audit.logRequest(req, 'login', { userId: user.id, metadata: { username: user.username } });
    if (json) return { ok: true, user };
    return reply.redirect(safeNext(next), 303);
  });

  app.post('/auth/refresh', async (req, reply) => {
    const rotated = auth.rotateRefreshToken(req.cookies.refresh_token);
    if (!rotated) {
      auth.clearSessionCookies(reply);
      return reply.code(401).send({ error: { code: 'INVALID_REFRESH', message: 'Session expired, please log in again' } });
    }
    auth.setSessionCookies(app, reply, rotated.user, rotated.refreshToken);
    return { ok: true, user: rotated.user };
  });

  // Browser-navigation helper: silently refresh then bounce back to where the user was going.
  app.get('/auth/renew', async (req, reply) => {
    const next = safeNext(req.query.next);
    const rotated = auth.rotateRefreshToken(req.cookies.refresh_token);
    if (!rotated) {
      auth.clearSessionCookies(reply);
      return reply.redirect(`/login?next=${encodeURIComponent(next)}`);
    }
    auth.setSessionCookies(app, reply, rotated.user, rotated.refreshToken);
    return reply.redirect(next);
  });

  app.post('/auth/logout', async (req, reply) => {
    const userId = auth.revokeRefreshToken(req.cookies.refresh_token);
    if (userId) audit.logRequest(req, 'logout', { userId });
    auth.clearSessionCookies(reply);
    if (isJson(req)) return { ok: true };
    return reply.redirect('/login', 303);
  });

  app.post('/auth/logout-all', { preHandler: requireAuth }, async (req, reply) => {
    const n = auth.revokeAllForUser(req.user.id);
    audit.logRequest(req, 'logout_all', { metadata: { revoked: n } });
    auth.clearSessionCookies(reply);
    if (isJson(req)) return { ok: true, revoked: n };
    return reply.redirect('/login', 303);
  });
}
