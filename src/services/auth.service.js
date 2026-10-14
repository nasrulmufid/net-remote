import bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { randomToken } from '../utils/crypto.js';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

// Dummy hash so unknown usernames cost the same as wrong passwords (timing).
const DUMMY_HASH = bcrypt.hashSync('netremote-dummy-password', 12);

/** SHA-256 (HMAC keyed with JWT_REFRESH_SECRET) of a refresh token; only this is stored. */
const hashToken = (t) => createHmac('sha256', config.JWT_REFRESH_SECRET).update(t).digest('hex');

const sqlTime = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Verify credentials.
 * @returns {{id:number, username:string, role:string}|null}
 */
export async function verifyCredentials(username, password) {
  const row = db.prepare('SELECT id, username, role, password_hash FROM users WHERE username = ?').get(username);
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) return null;
  return { id: row.id, username: row.username, role: row.role };
}

/** Create + persist a new refresh token, returns the raw token. */
export function createRefreshToken(userId) {
  const raw = randomToken(32);
  const expires = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, hashToken(raw), sqlTime(expires));
  return raw;
}

/**
 * Rotate a refresh token: old one is revoked, a new one issued.
 * Presenting an already-revoked token is treated as theft -> all tokens of that user are revoked.
 * @returns {{user:{id:number,username:string,role:string}, refreshToken:string}|null}
 */
export function rotateRefreshToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const h = hashToken(raw);
  return db.transaction(() => {
    const t = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(h);
    if (!t) return null;
    if (t.revoked) { revokeAllForUser(t.user_id); return null; }
    if (new Date(`${t.expires_at.replace(' ', 'T')}Z`) < new Date()) {
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(t.id);
      return null;
    }
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(t.user_id);
    if (!user) return null;
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(t.id);
    return { user, refreshToken: createRefreshToken(user.id) };
  })();
}

/** Revoke a single refresh token; returns user id if it existed. */
export function revokeRefreshToken(raw) {
  if (!raw) return null;
  const t = db.prepare('SELECT id, user_id FROM refresh_tokens WHERE token_hash = ?').get(hashToken(raw));
  if (!t) return null;
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(t.id);
  return t.user_id;
}

/** Revoke every refresh token of a user. */
export function revokeAllForUser(userId) {
  return db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(userId).changes;
}

/** Remove expired / revoked-and-old tokens. */
export function purgeTokens() {
  db.prepare(`DELETE FROM refresh_tokens WHERE expires_at < datetime('now') OR (revoked = 1 AND created_at < datetime('now','-8 days'))`).run();
}

/** Cookie options helpers. */
export const cookieBase = () => ({ httpOnly: true, secure: config.SESSION_COOKIE_SECURE, sameSite: 'strict' });

/**
 * Sign access JWT and set all session cookies (access, refresh, csrf).
 * @param {import('fastify').FastifyInstance} app
 */
export function setSessionCookies(app, reply, user, refreshToken) {
  const access = app.jwt.sign({ sub: String(user.id), username: user.username, role: user.role }, { expiresIn: ACCESS_TTL_SEC });
  reply.setCookie('access_token', access, { ...cookieBase(), path: '/', maxAge: ACCESS_TTL_SEC });
  reply.setCookie('refresh_token', refreshToken, { ...cookieBase(), path: '/auth', maxAge: REFRESH_TTL_SEC });
  const csrf = randomToken(24);
  reply.setCookie('csrf_token', csrf, { httpOnly: false, secure: config.SESSION_COOKIE_SECURE, sameSite: 'strict', path: '/', maxAge: REFRESH_TTL_SEC });
  return csrf;
}

export function clearSessionCookies(reply) {
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/auth' });
  reply.clearCookie('csrf_token', { path: '/' });
}
