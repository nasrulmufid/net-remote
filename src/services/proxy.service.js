/**
 * Helpers for the /remote/:uuid reverse proxy: URL rewriting for HTML/CSS/redirects/cookies
 * and the friendly error page.
 */

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
  'transfer-encoding', 'upgrade', 'proxy-connection',
]);

const OWN_COOKIES = new Set(['access_token', 'refresh_token', 'csrf_token']);

export const prefixFor = (uuid) => `/remote/${uuid}`;

/** Remove NetRemote's own cookies from a Cookie header so they never reach the device. */
export function stripOwnCookies(cookieHeader) {
  if (!cookieHeader) return undefined;
  const kept = cookieHeader.split(';').map((s) => s.trim()).filter((c) => c && !OWN_COOKIES.has(c.split('=')[0]));
  return kept.length ? kept.join('; ') : undefined;
}

/** Build upstream request headers from the incoming ones. */
export function buildUpstreamHeaders(req, device) {
  const h = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key) || key === 'host' || key === 'accept-encoding' || key === 'cookie' || key === 'authorization' || key.startsWith('x-forwarded-') || key === 'cf-connecting-ip' || key === 'x-csrf-token') continue;
    h[key] = v;
  }
  const origin = `${device.protocol}://${device.ip}:${device.port}`;
  h.host = `${device.ip}:${device.port}`;
  h['accept-encoding'] = 'identity'; // we need to read/rewrite bodies
  const cookie = stripOwnCookies(req.headers.cookie);
  if (cookie) h.cookie = cookie;
  // Make the device see itself as the origin (many UIs validate Origin/Referer).
  const pfx = new RegExp(`^https?://[^/]+${prefixFor(device.uuid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (h.referer) h.referer = String(h.referer).replace(pfx, origin);
  if (h.origin && h.origin !== 'null') h.origin = origin;
  return h;
}

/** Drop hop-by-hop + headers we must control from an upstream response. */
export function filterResponseHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key) || key === 'content-length' || key === 'content-security-policy' || key === 'content-security-policy-report-only'
      || key === 'strict-transport-security' || key === 'public-key-pins' || key === 'content-encoding') continue;
    out[key] = v;
  }
  return out;
}

/** Re-scope device cookies to /remote/{uuid}/ so they can't collide with NetRemote or other devices. */
export function rewriteSetCookie(values, uuid) {
  if (!values) return undefined;
  const arr = Array.isArray(values) ? values : [values];
  return arr.map((c) => {
    const parts = c.split(';').map((s) => s.trim()).filter((p) => !/^(domain|path)=/i.test(p));
    parts.push(`Path=${prefixFor(uuid)}/`);
    return parts.join('; ');
  });
}

/** Rewrite Location of redirects (absolute path or device-origin URL) into the proxied namespace. */
export function rewriteLocation(loc, device) {
  if (!loc) return loc;
  const pfx = prefixFor(device.uuid);
  if (loc.startsWith('//')) return loc;
  if (loc.startsWith('/')) return loc.startsWith(`${pfx}/`) ? loc : `${pfx}${loc}`;
  try {
    const u = new URL(loc);
    const sameHost = u.hostname === device.ip && Number(u.port || (u.protocol === 'https:' ? 443 : 80)) === Number(device.port);
    if (sameHost) return `${pfx}${u.pathname}${u.search}${u.hash}`;
  } catch { /* relative URL: leave */ }
  return loc;
}

const ATTR_RE = /(\s(?:src|href|action|poster|data|data-src|data-href|formaction)\s*=\s*)(["'])\/(?!\/)/gi;
const CSS_URL_RE = /url\(\s*(["']?)\/(?!\/)/gi;
const META_REFRESH_RE = /(<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*url\s*=\s*)\/(?!\/)/gi;

function prefixOnce(str, re, pfx, build) {
  return str.replace(re, (m, ...g) => {
    const off = g[g.length - 2]; // offset
    const rest = str.slice(off + m.length - 0, off + m.length + pfx.length);
    if (rest.startsWith(pfx.slice(1))) return m; // already prefixed ("/remote/uuid..." -> after the leading '/')
    return build(m, g, pfx);
  });
}

/** Rewrite absolute URLs in CSS text. */
export function rewriteCss(css, uuid) {
  const pfx = prefixFor(uuid);
  return prefixOnce(css, CSS_URL_RE, pfx, (m, g) => `url(${g[0]}${pfx}/`);
}

const clientShim = (pfx) => `<script>(function(){var P=${JSON.stringify(pfx)};function f(u){return typeof u==='string'&&u.charAt(0)==='/'&&u.charAt(1)!=='/'&&u.indexOf(P+'/')!==0&&u!==P?P+u:u}
var o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=f(u);return o.apply(this,arguments)};
if(window.fetch){var fe=window.fetch;window.fetch=function(i,n){if(typeof i==='string')i=f(i);return fe.call(this,i,n)}}
})();</script>`;

/**
 * Rewrite an HTML document: inject <base>, a tiny fetch/XHR shim, and prefix absolute URLs.
 * Bytes are processed as latin1 so non-UTF-8 pages survive the round-trip untouched.
 * @param {Buffer} buf
 * @param {string} uuid
 * @returns {Buffer}
 */
export function rewriteHtml(buf, uuid) {
  const pfx = prefixFor(uuid);
  let html = buf.toString('latin1');
  html = html.replace(/<base\b[^>]*>/gi, '');
  html = prefixOnce(html, ATTR_RE, pfx, (m, g) => `${g[0]}${g[1]}${pfx}/`);
  html = prefixOnce(html, CSS_URL_RE, pfx, (m, g) => `url(${g[0]}${pfx}/`);
  html = prefixOnce(html, META_REFRESH_RE, pfx, (m, g) => `${g[0]}${pfx}/`);
  const inject = `<base href="${pfx}/">${clientShim(pfx)}`;
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => `${m}${inject}`);
  else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
  else html = inject + html;
  return Buffer.from(html, 'latin1');
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Friendly standalone error page (self-contained styles, no external assets). */
export function errorPage({ title, message, device, code }) {
  const dev = device ? `<p class="meta">${esc(device.name)} · ${esc(device.ip)}:${esc(device.port)}</p>` : '';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · NetRemote</title><style>
:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f4f8;color:#1f2937;font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
.card{max-width:460px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.ico{width:56px;height:56px;border-radius:999px;background:#fee2e2;color:#dc2626;display:grid;place-items:center;margin:0 auto 16px;font-size:26px;font-weight:700}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 8px;color:#4b5563}.meta{font-family:ui-monospace,monospace;font-size:13px;color:#6b7280}
.code{font-size:12px;color:#9ca3af;margin-top:16px}.btns{display:flex;gap:8px;justify-content:center;margin-top:20px}
a,button{font:inherit;padding:8px 16px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#111827;text-decoration:none;cursor:pointer}
a.primary{background:#4f46e5;border-color:#4f46e5;color:#fff}
@media (prefers-color-scheme:dark){body{background:#111827;color:#e5e7eb}.card{background:#1f2937;border-color:#374151}p{color:#9ca3af}a,button{background:#374151;border-color:#4b5563;color:#f3f4f6}.ico{background:#450a0a}}
</style></head><body><main class="card"><div class="ico">!</div><h1>${esc(title)}</h1><p>${esc(message)}</p>${dev}
<div class="btns"><button onclick="location.reload()">Coba lagi</button><a class="primary" href="/">Kembali ke Dashboard</a></div>
<div class="code">${esc(code)}</div></main></body></html>`;
}
