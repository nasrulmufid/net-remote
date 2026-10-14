/** True when the client expects an HTML page (browser navigation). */
export function wantsHtml(req) {
  return req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next, fallback = '/') {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}

/**
 * preHandler: verify access-token cookie and attach `req.user`.
 * Browser navigations with an expired token are bounced through /auth/renew (which can read the refresh cookie).
 */
export async function requireAuth(req, reply) {
  try {
    const p = await req.jwtVerify({ onlyCookie: true });
    req.user = { id: Number(p.sub), username: p.username, role: p.role };
  } catch {
    if (req.method === 'GET' && (wantsHtml(req) || req.url.startsWith('/remote/'))) {
      return reply.redirect(`/auth/renew?next=${encodeURIComponent(req.url)}`);
    }
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }
}

/** preHandler: admin-only (use after requireAuth). */
export async function requireAdmin(req, reply) {
  if (req.user?.role !== 'admin') {
    return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
  }
}
