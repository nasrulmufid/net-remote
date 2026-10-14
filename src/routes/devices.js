import { z } from 'zod';
import * as devices from '../services/device.service.js';
import * as audit from '../services/audit.service.js';
import * as monitor from '../services/monitor.service.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { isUuid } from '../utils/uuid.js';

const notFound = (reply) =>
	reply
		.code(404)
		.send({ error: { code: 'NOT_FOUND', message: 'Device not found' } });

/** @param {import('fastify').FastifyInstance} app */
export default async function deviceRoutes(app) {
	const guard = { preHandler: requireAuth };
	const admin = { preHandler: [requireAuth, requireAdmin] };

	// ---------- JSON API ----------
	app.get('/api/devices', guard, async (req) => {
		const q = devices.deviceQuery.parse(req.query);
		return { items: devices.list(q), stats: devices.stats() };
	});

	// static routes before :uuid
	app.get('/api/devices/export', guard, async (req, reply) => {
		audit.logRequest(req, 'export', { metadata: { format: 'csv' } });
		return reply
			.header('content-type', 'text/csv; charset=utf-8')
			.header(
				'content-disposition',
				'attachment; filename="netremote-devices.csv"',
			)
			.send(devices.exportCsv());
	});

	app.get('/api/devices/import-template.xls', admin, async (req, reply) => {
		audit.logRequest(req, 'export', {
			metadata: { format: 'xls-import-template' },
		});
		return reply
			.header('content-type', 'application/vnd.ms-excel')
			.header(
				'content-disposition',
				'attachment; filename="netremote-device-import-template.xls"',
			)
			.send(devices.deviceImportTemplateXls());
	});

	app.post('/api/devices/import', admin, async (req, reply) => {
		const file = await req.file({
			limits: { fileSize: 5 * 1024 * 1024, files: 1 },
		});
		if (!file)
			return reply.code(400).send({
				error: { code: 'NO_FILE', message: 'Upload an .xls or .xlsx file' },
			});
		if (!/\.(?:xls|xlsx)$/i.test(file.filename))
			return reply.code(400).send({
				error: {
					code: 'BAD_FILE',
					message: 'Only .xls and .xlsx files are supported',
				},
			});
		const buf = await file.toBuffer();
		if (file.file.truncated)
			return reply
				.code(413)
				.send({ error: { code: 'TOO_LARGE', message: 'File exceeds 5 MB' } });
		let summary;
		try {
			summary = devices.importSpreadsheet(buf);
		} catch (e) {
			if (e.statusCode) throw e;
			return reply.code(400).send({
				error: { code: 'BAD_FILE', message: 'Could not read the workbook' },
			});
		}
		audit.logRequest(req, 'import', {
			metadata: {
				file: file.filename,
				imported: summary.imported,
				skipped: summary.skipped,
				errors: summary.errors.length,
			},
		});
		return summary;
	});

	app.get('/api/devices/:uuid', guard, async (req, reply) => {
		const d = isUuid(req.params.uuid)
			? devices.getByUuid(req.params.uuid)
			: null;
		return d ?? notFound(reply);
	});

	app.post('/api/devices', admin, async (req, reply) => {
		const data = devices.deviceInput.parse(req.body);
		const d = devices.create(data);
		audit.logRequest(req, 'create', {
			deviceId: d.id,
			metadata: { uuid: d.uuid, name: d.name, ip: d.ip, port: d.port },
		});
		monitor.checkDevice(d).catch((e) => req.log.warn(e)); // first status asap
		return reply.code(201).send(d);
	});

	app.put('/api/devices/:uuid', admin, async (req, reply) => {
		if (!isUuid(req.params.uuid)) return notFound(reply);
		const before = devices.getByUuid(req.params.uuid);
		const data = devices.deviceInput.parse(req.body);
		const d = devices.update(req.params.uuid, data);
		if (!d) return notFound(reply);
		const changed = Object.keys(data).filter(
			(k) => String(before[k] ?? '') !== String(d[k] ?? ''),
		);
		audit.logRequest(req, 'update', {
			deviceId: d.id,
			metadata: { uuid: d.uuid, changed },
		});
		return d;
	});

	app.delete('/api/devices/:uuid', admin, async (req, reply) => {
		if (!isUuid(req.params.uuid)) return notFound(reply);
		const d = devices.remove(req.params.uuid);
		if (!d) return notFound(reply);
		audit.logRequest(req, 'delete', {
			deviceId: d.id,
			metadata: { uuid: d.uuid, name: d.name, ip: d.ip, port: d.port },
		});
		return { ok: true };
	});

	// ---------- Pages ----------
	app.get('/devices/new', admin, async (req, reply) =>
		reply.view(
			'pages/device-form.ejs',
			{
				title: 'Tambah Perangkat',
				nav: 'devices',
				user: req.user,
				csrf: req.cookies.csrf_token ?? '',
				device: null,
				types: devices.DEVICE_TYPES,
				groups: devices.groups(),
			},
			{ layout: 'layouts/main.ejs' },
		),
	);

	app.get('/devices/:uuid', guard, async (req, reply) => {
		const d = isUuid(req.params.uuid)
			? devices.getByUuid(req.params.uuid)
			: null;
		if (!d)
			return reply.code(404).view(
				'pages/error.ejs',
				{
					title: 'Tidak ditemukan',
					nav: 'devices',
					user: req.user,
					csrf: '',
					code: 404,
					message: 'Perangkat tidak ditemukan.',
				},
				{ layout: 'layouts/main.ejs' },
			);
		return reply.view(
			'pages/device-detail.ejs',
			{
				title: d.name,
				nav: 'devices',
				user: req.user,
				csrf: req.cookies.csrf_token ?? '',
				device: d,
				checks: devices.recentChecks(d.id, 50),
				accesses: audit.remoteAccessForDevice(d.id, 50),
			},
			{ layout: 'layouts/main.ejs' },
		);
	});

	app.get('/devices/:uuid/edit', admin, async (req, reply) => {
		const d = isUuid(req.params.uuid)
			? devices.getByUuid(req.params.uuid)
			: null;
		if (!d)
			return reply.code(404).view(
				'pages/error.ejs',
				{
					title: 'Tidak ditemukan',
					nav: 'devices',
					user: req.user,
					csrf: '',
					code: 404,
					message: 'Perangkat tidak ditemukan.',
				},
				{ layout: 'layouts/main.ejs' },
			);
		return reply.view(
			'pages/device-form.ejs',
			{
				title: `Edit ${d.name}`,
				nav: 'devices',
				user: req.user,
				csrf: req.cookies.csrf_token ?? '',
				device: d,
				types: devices.DEVICE_TYPES,
				groups: devices.groups(),
			},
			{ layout: 'layouts/main.ejs' },
		);
	});
}
