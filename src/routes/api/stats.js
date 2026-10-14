import { z } from 'zod';
import * as devices from '../../services/device.service.js';
import * as audit from '../../services/audit.service.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { isUuid } from '../../utils/uuid.js';

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(40).optional(),
});

/** @param {import('fastify').FastifyInstance} app */
export default async function statsRoutes(app) {
  app.get('/api/stats', { preHandler: requireAuth }, async () => devices.stats());

  app.get('/api/stats/devices/:uuid', { preHandler: requireAuth }, async (req, reply) => {
    const d = isUuid(req.params.uuid) ? devices.getRawByUuid(req.params.uuid) : null;
    if (!d) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Device not found' } });
    const days = z.coerce.number().int().min(1).max(30).default(7).parse(req.query.days);
    return { uuid: d.uuid, days, ...devices.series(d.id, days) };
  });

  app.get('/api/audit', { preHandler: [requireAuth, requireAdmin] }, async (req) => {
    return audit.list(auditQuery.parse(req.query));
  });
}
