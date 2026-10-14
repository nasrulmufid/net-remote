import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import cron from 'node-cron';
import { db } from '../db/index.js';

const TIMEOUT_MS = 3000;
const MAX_CONCURRENCY = 10;
const HISTORY_DAYS = 30;

/** TCP connect; resolves {ok, ms}. */
function tcpCheck(ip, port) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const sock = net.connect({ host: ip, port });
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      sock.destroy();
      resolve({ ok, ms: Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1e6)) });
    };
    sock.setTimeout(TIMEOUT_MS, () => finish(false));
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
  });
}

/** HEAD / — any HTTP response (even 401/404/500) proves a web server answers. */
function httpCheck(protocol, ip, port) {
  return new Promise((resolve) => {
    const mod = protocol === 'https' ? https : http;
    const req = mod.request({ host: ip, port, method: 'HEAD', path: '/', timeout: TIMEOUT_MS, rejectUnauthorized: false, agent: false, headers: { 'user-agent': 'NetRemote-Monitor/1.0' } }, (res) => {
      res.resume(); resolve(true);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * Check one device and persist the result.
 * Online = TCP connect succeeds AND an HTTP(S) response is received.
 * @param {{id:number, ip:string, port:number, protocol:string}} d
 * @returns {Promise<{status:'online'|'offline', latency_ms:number|null}>}
 */
export async function checkDevice(d) {
  const tcp = await tcpCheck(d.ip, d.port);
  let online = tcp.ok;
  if (online) online = await httpCheck(d.protocol, d.ip, d.port);
  const status = online ? 'online' : 'offline';
  const latency = online ? tcp.ms : null;
  db.transaction(() => {
    if (online) {
      db.prepare(`UPDATE devices SET status='online', last_seen=CURRENT_TIMESTAMP, latency_ms=? WHERE id=?`).run(latency, d.id);
    } else {
      db.prepare(`UPDATE devices SET status='offline', latency_ms=NULL WHERE id=?`).run(d.id);
    }
    db.prepare('INSERT INTO check_history (device_id, status, latency_ms) VALUES (?, ?, ?)').run(d.id, status, latency);
  })();
  return { status, latency_ms: latency };
}

let running = false;

/** Check all devices with bounded concurrency. Skips if a run is still in progress. */
export async function checkAll(log) {
  if (running) { log?.warn('previous health-check cycle still running; skipping'); return null; }
  running = true;
  const started = Date.now();
  try {
    const devices = db.prepare('SELECT id, ip, port, protocol FROM devices').all();
    let i = 0; let online = 0;
    const worker = async () => {
      while (i < devices.length) {
        const d = devices[i++];
        try { if ((await checkDevice(d)).status === 'online') online += 1; } catch (e) { log?.error({ err: e, deviceId: d.id }, 'check failed'); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, devices.length) }, worker));
    log?.info({ total: devices.length, online, ms: Date.now() - started }, 'health-check cycle done');
    return { total: devices.length, online };
  } finally { running = false; }
}

/** Delete history older than 30 days. */
export function cleanupHistory(log) {
  const r = db.prepare(`DELETE FROM check_history WHERE checked_at < datetime('now', ?)`).run(`-${HISTORY_DAYS} days`);
  log?.info({ deleted: r.changes }, 'check_history cleanup');
}

/** Start cron jobs (every 60 s + daily cleanup). Returns a stop function. */
export function startMonitor(log) {
  const every = cron.schedule('* * * * *', () => { checkAll(log).catch((e) => log.error(e)); });
  const daily = cron.schedule('15 3 * * *', () => { try { cleanupHistory(log); } catch (e) { log.error(e); } });
  setTimeout(() => checkAll(log).catch((e) => log.error(e)), 2000).unref();
  return () => { every.stop(); daily.stop(); };
}
