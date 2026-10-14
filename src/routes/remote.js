import fp from 'fastify-plugin';
import replyFrom from '@fastify/reply-from';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as devices from '../services/device.service.js';
import * as audit from '../services/audit.service.js';
import { isUuid } from '../utils/uuid.js';
import {
  buildUpstreamHeaders, filterResponseHeaders, rewriteSetCookie, rewriteLocation,
  rewriteHtml, rewriteCss, errorPage, prefixFor,
} from '../services/proxy.service.js';

const MAX_REWRITE_BYTES = 10 * 1024 * 1024;
const lastLogged = new Map(); // `${userId}:${deviceId}` -> ts (throttle remote_access audit rows)

async function readAll(stream, limit) {
  const chunks = []; let n = 0;
  for await (const c of stream) { n += c.length; if (n > limit) throw new Error('response too large to rewrite'); chunks.push(c); }
  return Buffer.concat(chunks);
}

/**
 * ALL /remote/:uuid/*  — authenticated reverse proxy to a registered device.
 * Registered in its own encapsulated scope (no helmet / global rate-limit / csrf: those would break device UIs).
 */
export default fp(async function remoteRoutes(app) {
  await app.register(async (scope) => {
    await scope.register(replyFrom, {
      http: { requestOptions: { timeout: config.PROXY_TIMEOUT_MS } },
      undici: { connect: { rejectUnauthorized: false, timeout: config.PROXY_TIMEOUT_MS }, headersTimeout: config.PROXY_TIMEOUT_MS, bodyTimeout: config.PROXY_TIMEOUT_MS },
    });

    // Hand request bodies to reply-from as a raw stream (forms, JSON, multipart, firmware uploads...).
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (req, payload, done) => done(null, payload));

    const handler = async (req, reply) => {
      const { uuid } = req.params;
      const device = isUuid(uuid) ? devices.getRawByUuid(uuid) : null;
      if (!device) {
        return reply.code(404).type('text/html; charset=utf-8').send(errorPage({ title: 'Perangkat tidak ditemukan', message: 'Tidak ada perangkat dengan UUID tersebut.', code: 'NOT_FOUND' }));
      }

      // Canonical trailing slash so the injected <base> resolves correctly.
      const pfx = prefixFor(uuid);
      const rawUrl = req.raw.url;
      if (rawUrl === pfx || rawUrl.startsWith(`${pfx}?`)) {
        return reply.redirect(`${pfx}/${rawUrl.slice(pfx.length)}`, 308);
      }

      // Audit navigations (not every asset), throttled to 1/min per user+device.
      const dest = req.headers['sec-fetch-dest'];
      const isDoc = dest ? ['document', 'iframe', 'frame'].includes(dest) : (req.headers.accept ?? '').includes('text/html');
      if (isDoc) {
        const key = `${req.user.id}:${device.id}`;
        const now = Date.now();
        if (now - (lastLogged.get(key) ?? 0) > 60_000) {
          lastLogged.set(key, now);
          audit.logRequest(req, 'remote_access', { deviceId: device.id, metadata: { uuid, path: rawUrl.slice(pfx.length).split('?')[0] || '/' } });
        }
      }

      const target = `${device.protocol}://${device.ip}:${device.port}${rawUrl.slice(pfx.length) || '/'}`;
      return reply.from(target, {
        rewriteRequestHeaders: (r, headers) => buildUpstreamHeaders(r, device),
        onError: (rep, { error }) => {
          req.log.warn({ err: error, device: device.uuid }, 'proxy upstream error');
          const timeout = /timeout|UND_ERR_(HEADERS|BODY|CONNECT)_TIMEOUT/i.test(`${error?.code} ${error?.message}`);
          rep.code(timeout ? 504 : 502).type('text/html; charset=utf-8').send(errorPage({
            title: timeout ? 'Perangkat tidak merespons' : 'Perangkat tidak dapat dijangkau',
            message: timeout ? 'Waktu tunggu habis saat menghubungi perangkat.' : 'Koneksi ke perangkat gagal. Pastikan perangkat menyala dan jaringan terhubung.',
            device, code: error?.code ?? 'UPSTREAM_ERROR',
          }));
        },
        onResponse: async (r, rep, res) => {
          const headers = filterResponseHeaders(res.headers);
          if (headers['set-cookie']) headers['set-cookie'] = rewriteSetCookie(headers['set-cookie'], uuid);
          if (headers.location) headers.location = rewriteLocation(String(headers.location), device);
          if (headers['content-location']) delete headers['content-location'];
          const ctype = String(headers['content-type'] ?? '').toLowerCase();
          const isHtml = ctype.includes('text/html');
          const isCss = ctype.includes('text/css');
          rep.code(res.statusCode);
          for (const [k, v] of Object.entries(headers)) rep.header(k, v);
          if ((isHtml || isCss) && res.statusCode !== 204 && res.statusCode !== 304) {
            try {
              const buf = await readAll(res.stream, MAX_REWRITE_BYTES);
              return rep.send(isHtml ? rewriteHtml(buf, uuid) : Buffer.from(rewriteCss(buf.toString('latin1'), uuid), 'latin1'));
            } catch (e) {
              r.log.warn({ err: e }, 'rewrite failed');
              return rep.code(502).type('text/html; charset=utf-8').send(errorPage({ title: 'Respons terlalu besar', message: 'Halaman perangkat terlalu besar untuk diproses.', device, code: 'REWRITE_FAILED' }));
            }
          }
          return rep.send(res.stream);
        },
      });
    };

    const opts = { preHandler: requireAuth, bodyLimit: config.PROXY_MAX_BODY_BYTES };
    scope.route({ method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], url: '/remote/:uuid', ...opts, handler });
    scope.route({ method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], url: '/remote/:uuid/*', ...opts, handler });
  });
});
