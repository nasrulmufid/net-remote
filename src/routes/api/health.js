import * as devices from '../../services/device.service.js';
import * as monitor from '../../services/monitor.service.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { isUuid } from '../../utils/uuid.js';

/** @param {import('fastify').FastifyInstance} app */
export default async function healthRoutes(app) {
  // Liveness probe for Docker / load balancers (no auth, no data).
  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ ok: true }));

  app.post('/api/devices/:uuid/check', { preHandler: requireAuth }, async (req, reply) => {
    const d = isUuid(req.params.uuid) ? devices.getRawByUuid(req.params.uuid) : null;
    if (!d) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Device not found' } });
    const r = await monitor.checkDevice(d);
    return { uuid: d.uuid, ...r, device: devices.getByUuid(d.uuid) };
  });

  app.post('/api/health/check-all', { preHandler: requireAuth }, async (req) => {
    const r = await monitor.checkAll(req.log);
    return r ?? { skipped: true };
  });
}
