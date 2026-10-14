import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import view from '@fastify/view';
import ejs from 'ejs';
import { ZodError } from 'zod';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { icon } from './views/icons.js';
import { migrate, seedAdmin } from './db/index.js';
import { csrfHook } from './middleware/csrf.middleware.js';
import { wantsHtml } from './middleware/auth.middleware.js';
import { startMonitor } from './services/monitor.service.js';
import { purgeTokens } from './services/auth.service.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import deviceRoutes from './routes/devices.js';
import remoteRoutes from './routes/remote.js';
import healthRoutes from './routes/api/health.js';
import statsRoutes from './routes/api/stats.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Build the Fastify instance (exported for tests). */
export async function buildApp() {
	const app = Fastify({
		logger: {
			level: config.isProd ? 'info' : 'debug',
			redact: [
				'req.headers.cookie',
				'req.headers.authorization',
				'res.headers["set-cookie"]',
			],
		},
		trustProxy: config.TRUST_PROXY,
		bodyLimit: 1024 * 1024,
		routerOptions: { ignoreTrailingSlash: false },
	});

	migrate();
	seedAdmin(app.log);

	// ---- shared (root) plugins: cookies + JWT ----
	await app.register(cookie);
	await app.register(jwt, {
		secret: config.JWT_ACCESS_SECRET,
		cookie: { cookieName: 'access_token', signed: false },
	});

	// ---- error handling: { error: { code, message } } ----
	app.setErrorHandler((err, req, reply) => {
		let status = err.statusCode ?? 500;
		let code = err.code ?? 'INTERNAL';
		let message = err.message;
		let details;
		if (err instanceof ZodError) {
			status = 400;
			code = 'VALIDATION';
			message = 'Invalid input';
			details = err.issues.map((i) => ({
				path: i.path.join('.'),
				message: i.message,
			}));
		} else if (status === 429) {
			code = 'RATE_LIMITED';
			message = 'Terlalu banyak percobaan. Coba lagi sebentar lagi.';
		} else if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
			status = 413;
			code = 'TOO_LARGE';
			message = 'File too large';
		} else if (status >= 500) {
			req.log.error({ err }, 'unhandled error');
			code = 'INTERNAL';
			message = 'Internal server error';
		} else if (typeof code === 'string' && code.startsWith('FST_JWT')) {
			status = 401;
			code = 'UNAUTHORIZED';
			message = 'Authentication required';
		}
		// Login form hit the rate limit: show it on the login page instead of raw JSON.
		if (
			status === 429 &&
			req.url.startsWith('/auth/login') &&
			(req.headers.accept ?? '').includes('text/html')
		) {
			return reply.code(429).view('pages/login.ejs', {
				csrf: req.cookies?.csrf_token ?? '',
				next: '/',
				error: message,
				layout: false,
			});
		}
		if (wantsHtml(req) && !req.url.startsWith('/api/')) {
			return reply.code(status).view(
				'pages/error.ejs',
				{
					title: 'Terjadi kesalahan',
					nav: '',
					code: status,
					message,
				},
				{ layout: 'layouts/main.ejs' },
			);
		}
		return reply
			.code(status)
			.send({ error: { code, message, ...(details ? { details } : {}) } });
	});

	app.setNotFoundHandler((req, reply) => {
		if (wantsHtml(req))
			return reply.code(404).view(
				'pages/error.ejs',
				{
					title: 'Tidak ditemukan',
					nav: '',
					code: 404,
					message: 'Halaman tidak ditemukan.',
				},
				{ layout: 'layouts/main.ejs' },
			);
		return reply
			.code(404)
			.send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
	});

	// ---- /remote/* : its own scope (no helmet, global rate-limit, CSRF or body parsers of the web app) ----
	await app.register(remoteRoutes);

	// ---- web app scope ----
	await app.register(async (web) => {
		await web.register(helmet, {
			contentSecurityPolicy: {
				useDefaults: false,
				directives: {
					'default-src': ["'self'"],
					'script-src': ["'self'"],
					'style-src': ["'self'", "'unsafe-inline'"],
					'img-src': ["'self'", 'data:'],
					'font-src': ["'self'", 'data:'],
					'connect-src': ["'self'"],
					'object-src': ["'none'"],
					'base-uri': ["'self'"],
					'form-action': ["'self'"],
					'frame-ancestors': ["'none'"],
				},
			},
			strictTransportSecurity: config.SESSION_COOKIE_SECURE,
			crossOriginEmbedderPolicy: false,
		});
		await web.register(rateLimit, {
			global: true,
			max: 100,
			timeWindow: '1 minute',
		});
		await web.register(formbody);
		await web.register(multipart, {
			limits: { fileSize: 5 * 1024 * 1024, files: 1 },
		});
		await web.register(view, {
			engine: { ejs },
			root: join(here, 'views'),
			propertyName: 'view',
			defaultContext: {
				icon,
				appName: 'NetRemote',
				user: null,
				nav: '',
				title: '',
				csrf: '',
				flash: null,
			},
		});
		await web.register(fastifyStatic, {
			root: join(root, 'public'),
			prefix: '/',
			maxAge: config.isProd ? '1h' : 0,
		});
		await web.register(fastifyStatic, {
			root: join(root, 'node_modules', 'apexcharts', 'dist'),
			prefix: '/vendor/apexcharts/',
			decorateReply: false,
			maxAge: config.isProd ? '1d' : 0,
		});
		await web.register(fastifyStatic, {
			root: join(root, 'node_modules'),
			prefix: '/vendor/',
			decorateReply: false,
			maxAge: config.isProd ? '1d' : 0,
		});
		web.addHook('onRequest', csrfHook);

		await web.register(authRoutes);
		await web.register(dashboardRoutes);
		await web.register(deviceRoutes);
		await web.register(healthRoutes);
		await web.register(statsRoutes);
	});

	return app;
}

async function main() {
	const app = await buildApp();
	const stopMonitor = startMonitor(app.log);
	const purge = setInterval(
		() => {
			try {
				purgeTokens();
			} catch (e) {
				app.log.error(e);
			}
		},
		6 * 3600 * 1000,
	);
	purge.unref();

	const shutdown = async (sig) => {
		app.log.info({ sig }, 'shutting down');
		stopMonitor();
		clearInterval(purge);
		await app.close();
		process.exit(0);
	};
	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	await app.listen({ port: config.PORT, host: '0.0.0.0' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
