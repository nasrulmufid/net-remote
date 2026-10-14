import { z } from 'zod';
import * as devices from '../services/device.service.js';
import * as audit from '../services/audit.service.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const listQuery = devices.deviceQuery.extend({
	status: z
		.enum(['online', 'offline', 'unknown', ''])
		.optional()
		.transform((v) => v || undefined),
});
const auditPage = z.object({
	page: z.coerce.number().int().min(1).default(1),
	action: z.string().max(40).optional(),
});

/** @param {import('fastify').FastifyInstance} app */
export default async function dashboardRoutes(app) {
	const guard = { preHandler: requireAuth };

	const tableCtx = (req, q, nav, title, showStats) => ({
		title,
		nav,
		user: req.user,
		csrf: req.cookies.csrf_token ?? '',
		showStats,
		items: devices.list(q),
		stats: devices.stats(),
		groups: devices.groups(),
		filters: q,
	});

	app.get('/', guard, async (req, reply) => {
		const q = listQuery.parse(req.query);
		return reply.view(
			'pages/dashboard.ejs',
			tableCtx(req, q, 'dashboard', 'Dashboard', true),
			{ layout: 'layouts/main.ejs' },
		);
	});

	app.get('/devices', guard, async (req, reply) => {
		const q = listQuery.parse(req.query);
		return reply.view(
			'pages/dashboard.ejs',
			tableCtx(req, q, 'devices', 'Perangkat', false),
			{ layout: 'layouts/main.ejs' },
		);
	});

	// HTML fragment used by the 30 s polling + filters (rows rendered server-side by one partial).
	app.get('/fragments/device-rows', guard, async (req, reply) => {
		const q = listQuery.parse(req.query);
		const html = await app.view(
			'partials/device-rows.ejs',
			{ items: devices.list(q), user: req.user },
			{ layout: false },
		);
		return reply
			.header('cache-control', 'no-store')
			.type('text/html; charset=utf-8')
			.send(html);
	});

	app.get('/groups', guard, async (req, reply) =>
		reply.view(
			'pages/groups.ejs',
			{
				title: 'Grup',
				nav: 'groups',
				user: req.user,
				csrf: req.cookies.csrf_token ?? '',
				groups: devices.groups(),
			},
			{ layout: 'layouts/main.ejs' },
		),
	);

	app.get(
		'/audit',
		{ preHandler: [requireAuth, requireAdmin] },
		async (req, reply) => {
			const q = auditPage.parse(req.query);
			return reply.view(
				'pages/audit.ejs',
				{
					title: 'Audit Log',
					nav: 'audit',
					user: req.user,
					csrf: req.cookies.csrf_token ?? '',
					data: audit.list({ page: q.page, limit: 50, action: q.action }),
					action: q.action ?? '',
				},
				{ layout: 'layouts/main.ejs' },
			);
		},
	);

	app.get('/settings', guard, async (req, reply) =>
		reply.view(
			'pages/settings.ejs',
			{
				title: 'Pengaturan',
				nav: 'settings',
				user: req.user,
				csrf: req.cookies.csrf_token ?? '',
			},
			{ layout: 'layouts/main.ejs' },
		),
	);
}
