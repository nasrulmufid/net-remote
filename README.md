# NetRemote

Device monitor & remote HTTP access for network gear (OLT, ONU, switch, router, AP).
Each device gets a UUID; its web UI is reachable only after login at `/remote/<uuid>/`.

## Architecture

```
 Browser ──HTTPS──▶ Cloudflare Tunnel (optional) ──▶ NetRemote (Fastify :3000)
                                                      │
        ┌─────────────────────────────────────────────┤
        │ web scope  : helmet CSP · rate-limit · CSRF · EJS pages · /api/*
        │ remote scope: /remote/:uuid/*  (auth guard → audit → reverse proxy + HTML/CSS rewrite)
        │ monitor    : node-cron (60 s, ≤10 parallel TCP+HEAD checks) · daily history cleanup
        └──▶ SQLite (WAL)  users · refresh_tokens · devices · check_history · audit_logs
                                   │
                                   └──▶ device web UIs on the LAN (http/https, any port)
```

## Setup

Requires Node.js 20+.

### Local dev
```bash
npm install
cp .env.example .env        # then set real secrets (see below)
npm run build:css           # Tailwind v4 via Vite → public/dist/app.css
npm run dev                 # http://localhost:3000
npm run seed                # optional demo devices
```
Generate secrets: `openssl rand -hex 32` (use for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`).
On first boot the admin user is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### VPS (systemd / pm2)
```bash
npm ci && npm run build:css
NODE_ENV=production SESSION_COOKIE_SECURE=true TRUST_PROXY=true node src/server.js
```
Put it behind HTTPS (nginx/Caddy/Cloudflare). Keep `data/` on persistent disk and back it up.

### Docker
```bash
cp .env.example .env   # edit secrets; set SESSION_COOKIE_SECURE=true when served over HTTPS
docker compose up -d --build
```
Multi-stage image, runs as non-root `node`, SQLite in `./data`. The NetRemote host must be able to reach the device LAN.

## Cloudflare Tunnel
Copy `cloudflared/config.yml.example`, put your credentials in `cloudflared/creds.json`, uncomment the `cloudflared` service in `docker-compose.yml`.
The app serves both the dashboard and `/remote/*`, so all paths route to the same origin. Set `SESSION_COOKIE_SECURE=true` and `TRUST_PROXY=true`.

## Design decisions
- **Proxy**: `@fastify/reply-from` (the engine under `@fastify/http-proxy`) with a per-request upstream, since the target comes from the DB.
- **HTML rewrite**: `<base href="/remote/<uuid>/">`, prefixing of absolute `src/href/action/url()/meta refresh`, a tiny fetch/XHR shim for root-absolute JS calls, `Location` and `Set-Cookie` (cookies re-scoped to `/remote/<uuid>/`). JS files pass through unchanged — JS that builds absolute paths dynamically beyond fetch/XHR may still need manual handling.
- NetRemote cookies (`access_token`, `refresh_token`, `csrf_token`) are stripped before forwarding to devices.
- **Online** = TCP connect succeeds **and** an HTTP(S) response arrives to `HEAD /`.
- **Auth**: access JWT 15 min; refresh token 7 days, random 32 bytes, stored only as HMAC-SHA256 hash, rotated on every use. Re-presenting a revoked token revokes all of that user's sessions. Browser navigations with an expired access token are silently renewed through `/auth/renew`.
- **CSRF**: double-submit cookie on `/api/*` mutations. `/auth/*` is exempt (login form has its own hidden token; cookies are `SameSite=Strict`). `/remote/*` is exempt because device forms can't send our header.
- `audit_logs.device_id` has no FK so audit rows survive device deletion. `remote_access` is logged per page navigation, throttled to 1/min per user+device.
- Duplicate `ip:port` is enforced by a unique index. Roles: `admin` (full), `viewer` (read + remote access).
- Charts and fonts are self-hosted (ApexCharts served from `node_modules`), so the CSP stays `'self'`.

## Security notes
bcrypt (12 rounds) · httpOnly + SameSite=Strict cookies · Secure in prod · rate limit 5/min on login, 100/min elsewhere · Helmet CSP · Zod validation on all inputs · prepared statements only · EJS auto-escaping · CSV export neutralizes formula injection · 30 s proxy timeout and body size limit · auth required before any proxying.
Devices are reached with TLS verification disabled (self-signed certs are the norm on gear). Do not register hosts you don't trust.

## API reference
All except `/auth/*`, `/login`, `/healthz` require login. Mutations need header `X-CSRF-Token` = `csrf_token` cookie. Errors: `{ "error": { "code", "message" } }`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` `/auth/refresh` `/auth/logout` `/auth/logout-all` | JSON or form |
| GET | `/api/devices?search=&status=&tag=` | list + stats |
| GET | `/api/devices/:uuid` | detail |
| POST/PUT/DELETE | `/api/devices[/:uuid]` | admin |
| POST | `/api/devices/import` | admin, multipart `.xlsx`: name, ip, port, type, vendor, location, group_tag |
| GET | `/api/devices/export` | CSV |
| POST | `/api/devices/:uuid/check` · `/api/health/check-all` | manual check |
| GET | `/api/stats` · `/api/stats/devices/:uuid?days=7` | counters · chart series |
| GET | `/api/audit?page=1&limit=50&action=` | admin |
| ALL | `/remote/:uuid/*` | authenticated proxy |
| GET | `/healthz` | liveness |

## Screenshots
`docs/dashboard.png` · `docs/device-detail.png` · `docs/dark.png` (placeholders)
