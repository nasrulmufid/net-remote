import { z } from 'zod';
import { read, utils, write } from 'xlsx';
import { db } from '../db/index.js';
import { newUuid } from '../utils/uuid.js';

export const DEVICE_TYPES = ['OLT', 'ONU', 'Switch', 'Router', 'AP', 'Other'];

const optText = (max) =>
	z.preprocess(
		(v) =>
			v === '' || v === null || v === undefined ? null : String(v).trim(),
		z.string().max(max).nullable(),
	);

const ipSchema = z.preprocess(
	(v) => (typeof v === 'string' ? v.trim() : v),
	z.union([z.ipv4(), z.ipv6()], { error: 'Invalid IP address' }),
);

/** Zod schema for create/update payloads. */
export const deviceInput = z.object({
	name: z.string().trim().min(1, 'Name is required').max(100),
	ip: ipSchema,
	port: z
		.preprocess(
			(v) => (v === '' || v == null ? 80 : v),
			z.coerce.number().int().min(1).max(65535),
		)
		.default(80),
	protocol: z.enum(['http', 'https']).default('http'),
	type: optText(30),
	vendor: optText(60),
	location: optText(120),
	group_tag: optText(60),
	notes: optText(2000),
});

export const deviceQuery = z.object({
	search: z.string().trim().max(100).optional(),
	status: z.enum(['online', 'offline', 'unknown']).optional(),
	tag: z.string().trim().max(60).optional(),
});

const toIso = (s) => (s ? `${s.replace(' ', 'T')}Z` : null);
/** Map a DB row to API shape (id kept internal for relations, ISO timestamps). */
export const present = (r) =>
	r && {
		...r,
		last_seen: toIso(r.last_seen),
		created_at: toIso(r.created_at),
		updated_at: toIso(r.updated_at),
	};

/** @param {z.infer<typeof deviceQuery>} q */
export function list(q = {}) {
	const where = [];
	const args = [];
	if (q.search) {
		where.push(
			'(name LIKE ? OR ip LIKE ? OR vendor LIKE ? OR location LIKE ? OR group_tag LIKE ?)',
		);
		const s = `%${q.search.replace(/[%_]/g, '\\$&')}%`;
		where[0] = where[0].replace(/\?/g, `? ESCAPE '\\'`);
		args.push(s, s, s, s, s);
	}
	if (q.status) {
		where.push('status = ?');
		args.push(q.status);
	}
	if (q.tag) {
		where.push('group_tag = ?');
		args.push(q.tag);
	}
	const sql = `SELECT * FROM devices ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name COLLATE NOCASE`;
	return db
		.prepare(sql)
		.all(...args)
		.map(present);
}

export const getByUuid = (uuid) =>
	present(db.prepare('SELECT * FROM devices WHERE uuid = ?').get(uuid));
export const getRawByUuid = (uuid) =>
	db.prepare('SELECT * FROM devices WHERE uuid = ?').get(uuid);

export function stats() {
	const r = db
		.prepare(
			`SELECT COUNT(*) total,
      COALESCE(SUM(status='online'),0) online, COALESCE(SUM(status='offline'),0) offline,
      COALESCE(SUM(status='unknown'),0) unknown FROM devices`,
		)
		.get();
	return r;
}

export function groups() {
	return db
		.prepare(
			`SELECT group_tag AS name, COUNT(*) AS total, SUM(status='online') AS online, SUM(status='offline') AS offline
      FROM devices WHERE group_tag IS NOT NULL AND group_tag <> '' GROUP BY group_tag ORDER BY group_tag COLLATE NOCASE`,
		)
		.all();
}

export class ConflictError extends Error {
	constructor(msg) {
		super(msg);
		this.statusCode = 409;
		this.code = 'CONFLICT';
	}
}

/**
 * Create a device with a fresh UUID. Throws ConflictError on duplicate ip:port.
 * @param {z.infer<typeof deviceInput>} data
 */
export function create(data) {
	const uuid = newUuid();
	try {
		db.prepare(
			`INSERT INTO devices (uuid,name,ip,port,protocol,type,vendor,location,group_tag,notes)
      VALUES (@uuid,@name,@ip,@port,@protocol,@type,@vendor,@location,@group_tag,@notes)`,
		).run({ uuid, ...data });
	} catch (e) {
		if (String(e.code).startsWith('SQLITE_CONSTRAINT'))
			throw new ConflictError(
				`A device with ${data.ip}:${data.port} already exists`,
			);
		throw e;
	}
	return getByUuid(uuid);
}

export function update(uuid, data) {
	const cur = getRawByUuid(uuid);
	if (!cur) return null;
	try {
		db.prepare(
			`UPDATE devices SET name=@name, ip=@ip, port=@port, protocol=@protocol, type=@type, vendor=@vendor,
      location=@location, group_tag=@group_tag, notes=@notes, updated_at=CURRENT_TIMESTAMP,
      status = CASE WHEN ip<>@ip OR port<>@port OR protocol<>@protocol THEN 'unknown' ELSE status END
      WHERE uuid=@uuid`,
		).run({ uuid, ...data });
	} catch (e) {
		if (String(e.code).startsWith('SQLITE_CONSTRAINT'))
			throw new ConflictError(
				`A device with ${data.ip}:${data.port} already exists`,
			);
		throw e;
	}
	return getByUuid(uuid);
}

/** Delete a device (check_history cascades; audit_logs rows stay). */
export function remove(uuid) {
	const cur = getRawByUuid(uuid);
	if (!cur) return null;
	db.prepare('DELETE FROM devices WHERE id = ?').run(cur.id);
	return present(cur);
}

/**
 * Bulk import from an .xls or .xlsx buffer. Columns: name, ip, port, type, vendor, location, group_tag.
 * @returns {{imported:number, skipped:number, errors:{row:number,message:string}[]}}
 */
export function importSpreadsheet(buffer) {
	const wb = read(buffer, { type: 'buffer' });
	const sheet = wb.Sheets[wb.SheetNames[0]];
	if (!sheet)
		throw Object.assign(new Error('Workbook has no sheets'), {
			statusCode: 400,
			code: 'BAD_FILE',
		});
	if (!sheet['!ref'])
		throw Object.assign(new Error('Worksheet is empty'), {
			statusCode: 400,
			code: 'BAD_FILE',
		});
	const range = utils.decode_range(sheet['!ref']);
	const rowCount = range.e.r - range.s.r + 1;
	const columnCount = range.e.c - range.s.c + 1;
	if (rowCount > 5001 || columnCount > 100 || rowCount * columnCount > 100000) {
		throw Object.assign(new Error('Worksheet is too large'), {
			statusCode: 400,
			code: 'BAD_FILE',
		});
	}
	const rows = utils.sheet_to_json(sheet, { defval: '', raw: false });
	if (rows.length > 5000)
		throw Object.assign(new Error('Too many rows (max 5000)'), {
			statusCode: 400,
			code: 'BAD_FILE',
		});
	const out = { imported: 0, skipped: 0, errors: [] };
	const created = [];
	rows.forEach((raw, i) => {
		const row = {};
		for (const [k, v] of Object.entries(raw))
			row[String(k).trim().toLowerCase().replace(/\s+/g, '_')] =
				typeof v === 'string' ? v.trim() : v;
		const rowNo = i + 2; // header is row 1
		const parsed = deviceInput.safeParse({
			name: row.name,
			ip: row.ip,
			port: row.port,
			protocol: row.protocol || 'http',
			type: row.type,
			vendor: row.vendor,
			location: row.location,
			group_tag: row.group_tag ?? row.group ?? row.tag,
			notes: row.notes,
		});
		if (!parsed.success) {
			out.errors.push({
				row: rowNo,
				message: parsed.error.issues
					.map((x) => `${x.path.join('.')}: ${x.message}`)
					.join('; '),
			});
			return;
		}
		try {
			created.push(create(parsed.data));
			out.imported += 1;
		} catch (e) {
			if (e instanceof ConflictError) out.skipped += 1;
			else out.errors.push({ row: rowNo, message: e.message });
		}
	});
	return out;
}

/** Backward-compatible alias for callers using the former XLSX-only function. */
export const importXlsx = importSpreadsheet;

/** Build a blank legacy Excel template for importing devices. */
export function deviceImportTemplateXls() {
	const headers = [
		'name',
		'ip',
		'port',
		'protocol',
		'type',
		'vendor',
		'location',
		'group_tag',
		'notes',
	];
	const devicesSheet = utils.aoa_to_sheet([headers]);
	devicesSheet['!cols'] = [24, 18, 10, 12, 16, 18, 24, 18, 36].map((wch) => ({
		wch,
	}));

	const guideSheet = utils.aoa_to_sheet([
		['Kolom', 'Wajib', 'Keterangan'],
		['name', 'Ya', 'Nama perangkat.'],
		['ip', 'Ya', 'Alamat IPv4 atau IPv6.'],
		['port', 'Tidak', 'Port 1–65535; default 80.'],
		['protocol', 'Tidak', 'http atau https; default http.'],
		['type', 'Tidak', 'Jenis perangkat, contoh: Router, Switch, atau AP.'],
		['vendor', 'Tidak', 'Nama vendor/perangkat.'],
		['location', 'Tidak', 'Lokasi perangkat.'],
		['group_tag', 'Tidak', 'Nama grup perangkat.'],
		['notes', 'Tidak', 'Catatan tambahan.'],
	]);
	guideSheet['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 54 }];

	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, devicesSheet, 'Perangkat');
	utils.book_append_sheet(workbook, guideSheet, 'Petunjuk');
	return write(workbook, { type: 'buffer', bookType: 'xls' });
}

const csvCell = (v) => {
	let s = v == null ? '' : String(v);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formulas
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV export of all devices. */
export function exportCsv() {
	const cols = [
		'uuid',
		'name',
		'ip',
		'port',
		'protocol',
		'type',
		'vendor',
		'location',
		'group_tag',
		'status',
		'latency_ms',
		'last_seen',
		'notes',
	];
	const lines = [cols.join(',')];
	for (const d of list()) lines.push(cols.map((c) => csvCell(d[c])).join(','));
	return `${lines.join('\n')}\n`;
}

/** Recent checks for a device. */
export function recentChecks(deviceId, limit = 50) {
	return db
		.prepare(
			'SELECT status, latency_ms, checked_at FROM check_history WHERE device_id = ? ORDER BY id DESC LIMIT ?',
		)
		.all(deviceId, limit)
		.map((r) => ({ ...r, checked_at: toIso(r.checked_at) }));
}

/**
 * Time-bucketed series for charts.
 * @param {number} deviceId
 * @param {number} days
 */
export function series(deviceId, days = 7) {
	const bucketMin = days <= 1 ? 5 : days <= 3 ? 15 : 30;
	const rows = db
		.prepare(
			`
    SELECT (CAST(strftime('%s', checked_at) AS INTEGER) / (? * 60)) * (? * 60) AS ts,
           AVG(CASE WHEN status='online' THEN latency_ms END) AS latency,
           SUM(status='online') AS up, COUNT(*) AS n
      FROM check_history
     WHERE device_id = ? AND checked_at >= datetime('now', ?)
     GROUP BY ts ORDER BY ts`,
		)
		.all(bucketMin, bucketMin, deviceId, `-${days} days`);
	const tot = rows.reduce((a, r) => ({ up: a.up + r.up, n: a.n + r.n }), {
		up: 0,
		n: 0,
	});
	return {
		bucket_minutes: bucketMin,
		uptime_pct: tot.n ? Math.round((tot.up / tot.n) * 10000) / 100 : null,
		points: rows.map((r) => ({
			t: r.ts * 1000,
			latency: r.latency == null ? null : Math.round(r.latency),
			up_ratio: r.up / r.n,
		})),
	};
}
