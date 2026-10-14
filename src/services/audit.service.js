import { db } from '../db/index.js';

const insertStmt = db.prepare(
  `INSERT INTO audit_logs (user_id, device_id, action, ip_address, user_agent, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
);

/**
 * Write one audit entry.
 * @param {{userId?:number|null, deviceId?:number|null, action:string, ip?:string, userAgent?:string, metadata?:object}} e
 */
export function log(e) {
  insertStmt.run(
    e.userId ?? null,
    e.deviceId ?? null,
    e.action,
    e.ip ?? null,
    (e.userAgent ?? '').slice(0, 300) || null,
    e.metadata ? JSON.stringify(e.metadata) : null,
  );
}

/**
 * Convenience wrapper that pulls user / ip / UA from a Fastify request.
 * @param {import('fastify').FastifyRequest} req
 * @param {string} action
 * @param {{deviceId?:number|null, userId?:number|null, metadata?:object}} [extra]
 */
export function logRequest(req, action, extra = {}) {
  log({
    userId: extra.userId ?? req.user?.id ?? null,
    deviceId: extra.deviceId ?? null,
    action,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: extra.metadata,
  });
}

const toIso = (s) => (s ? `${s.replace(' ', 'T')}Z` : null);

function mapRow(r) {
  let metadata = null;
  try { metadata = r.metadata ? JSON.parse(r.metadata) : null; } catch { metadata = null; }
  return { ...r, metadata, created_at: toIso(r.created_at) };
}

/**
 * Paginated audit listing.
 * @param {{page?:number, limit?:number, action?:string, deviceId?:number}} q
 */
export function list({ page = 1, limit = 50, action, deviceId } = {}) {
  const where = []; const args = [];
  if (action) { where.push('a.action = ?'); args.push(action); }
  if (deviceId) { where.push('a.device_id = ?'); args.push(deviceId); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs a ${w}`).get(...args).c;
  const rows = db.prepare(
    `SELECT a.*, u.username, d.name AS device_name, d.uuid AS device_uuid
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN devices d ON d.id = a.device_id
       ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
  ).all(...args, limit, (page - 1) * limit).map(mapRow);
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), items: rows };
}

/** Recent remote accesses for a device. */
export function remoteAccessForDevice(deviceId, limit = 50) {
  return db.prepare(
    `SELECT a.id, a.ip_address, a.user_agent, a.created_at, u.username
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.device_id = ? AND a.action = 'remote_access'
      ORDER BY a.id DESC LIMIT ?`,
  ).all(deviceId, limit).map((r) => ({ ...r, created_at: toIso(r.created_at) }));
}
